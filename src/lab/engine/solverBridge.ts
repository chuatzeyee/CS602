// solverBridge.ts - Excel Solver emulation for a HyperFormula workbook.
// 1. Read the model as a black box: objective / constraint cells as functions of the changing cells.
// 2. Finite differences give the linear coefficients; random probes check that the model IS linear.
// 3. Linear -> javascript-lp-solver (simplex; branch-and-cut for int/bin), like Excel "Simplex LP". Like Excel, the
//    answer is then re-checked against the sheet: a model that only looked linear near the start (a bracket lookup
//    that jumps further out) is not linear, and is searched as a non-linear model instead.
// 4. Non-linear -> penalised, bounded Nelder-Mead with restarts (a stand-in for "GRG Nonlinear"); multiStart() is a
//    quick extra search from spread-out points (Solver's Multistart option).
// Excel's Options: spec.deadline (Max Time) stops branch and cut and every search with the best point found so far
// (result.stopped); spec.integerTolerance (Integer Optimality) lets branch and cut stop within that gap of the LP bound.
import solver from 'javascript-lp-solver';
import type { HyperFormula, SimpleCellAddress } from 'hyperformula';
import type { Model as LpModel } from 'javascript-lp-solver';
import { addr, readCell } from './workbook.ts';
import { nelderMead } from './nelderMead.ts';

export type Relation = '<=' | '>=' | '=';
export interface SolverConstraint { lhs: string; relation: Relation; rhs: number | string }
export interface SolverSpec {
  objective: string;
  sense: 'max' | 'min';
  changing: string[];
  constraints: SolverConstraint[];
  integer?: string[];
  binary?: string[];
  nonNegative?: boolean;                               // Excel's "Make Unconstrained Variables Non-Negative" (default on)
  bounds?: Record<string, { lo?: number; hi?: number }>; // used for probes and the non-linear search
  sheet?: string;
  linearOnly?: boolean;                                // Simplex LP: a non-linear model stops with linear: false, no search
  deadline?: number;                                   // performance.now() time: stop with the best point so far (Max Time)
  integerTolerance?: number;                           // Integer Optimality as a fraction (0.01 = 1%); default 0 = proven
}
export interface SolverResult {
  status: 'optimal' | 'infeasible' | 'unbounded' | 'not-converged';
  method: 'simplex' | 'branch-and-cut' | 'nelder-mead';
  objective: number;
  values: Record<string, number>;
  linear: boolean;
  linearAtStart?: boolean;  // the probes around the start saw a linear model (with linear false: a step further out)
  maxLinearityError: number;
  evaluations: number;
  ms: number;
  stopped?: boolean;         // the deadline ended the search: the values are the best point found so far
  withinTolerance?: boolean; // a whole-number answer accepted within integerTolerance of the LP bound (not proven best)
}
type Box = { lo: number; hi: number }[];
type Evaluate = (x: number[]) => number[];
interface Linearised { coef: number[][]; constant: number[] }

export const LINEAR_TOLERANCE = 1e-7;
const FEASIBLE_TOLERANCE = 1e-6;
const late = (deadline?: number): boolean => deadline !== undefined && performance.now() > deadline;

const num = (hf: HyperFormula, at: SimpleCellAddress): number => {
  const r = readCell(hf, at);
  return r.kind === 'number' ? r.value : r.kind === 'empty' ? 0 : NaN;
};

/** Evaluate [objective, g_1..g_m] at x, where g_i = lhs_i - rhs_i (so every constraint is g_i REL 0). */
function makeEvaluator(hf: HyperFormula, spec: SolverSpec) {
  const vars = spec.changing.map((c) => addr(hf, c, spec.sheet));
  const obj = addr(hf, spec.objective, spec.sheet);
  const lhs = spec.constraints.map((c) => addr(hf, c.lhs, spec.sheet));
  const rhs = spec.constraints.map((c) => (typeof c.rhs === 'number' ? c.rhs : addr(hf, c.rhs, spec.sheet)));
  let evaluations = 0;
  const rhsAt = (i: number) => (typeof rhs[i] === 'number' ? (rhs[i] as number) : num(hf, rhs[i] as SimpleCellAddress));
  const evaluate = (x: number[]): number[] => {
    evaluations += 1;
    hf.batch(() => vars.forEach((v, j) => hf.setCellContents(v, [[x[j]]]))); // one recalculation
    return [num(hf, obj), ...lhs.map((l, i) => num(hf, l) - rhsAt(i))];
  };
  // objective and worst constraint breach at x, the breach scaled by the size of both sides (the same yardstick for
  // every point, unlike the search's own scaling)
  const assess = (x: number[]): { objective: number; violation: number } => {
    const objective = evaluate(x)[0];
    let violation = 0;
    spec.constraints.forEach((c, i) => {
      const l = num(hf, lhs[i]);
      const r = rhsAt(i);
      const g = l - r;
      const breach = c.relation === '<=' ? Math.max(0, g) : c.relation === '>=' ? Math.max(0, -g) : Math.abs(g);
      const scaled = breach / (1 + Math.abs(l) + Math.abs(r));
      violation = Math.max(violation, Number.isFinite(scaled) ? scaled : Infinity);
    });
    return { objective: Number.isFinite(objective) ? objective : NaN, violation };
  };
  return { vars, evaluate, assess, count: () => evaluations };
}

/** The objective and the worst scaled constraint breach with the variable cells at `values` (left there). */
export function assessPoint(hf: HyperFormula, spec: SolverSpec, values: Record<string, number>): { objective: number; violation: number } {
  return makeEvaluator(hf, spec).assess(spec.changing.map((c) => values[c] ?? 0));
}

/** Deterministic pseudo-random numbers for the linearity probes and the multi-start points. */
function probeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Largest relative gap between the linear model and the sheet over the given points. byTerms: relative to the size of
 *  the terms as well, so far from the start the rounding in the coefficients (differences of large values) is not
 *  taken for a kink where a constraint is binding (value near 0). */
function gapAt(evaluate: Evaluate, lin: Linearised, points: number[][], byTerms = false): number {
  let maxErr = 0;
  for (const x of points) {
    evaluate(x).forEach((v, i) => {
      const terms = lin.coef[i].map((c, j) => c * x[j]);
      const predicted = lin.constant[i] + terms.reduce((s, t) => s + t, 0);
      const size = 1 + Math.abs(v) + (byTerms ? Math.abs(lin.constant[i]) + terms.reduce((s, t) => s + Math.abs(t), 0) : 0);
      const err = Math.abs(v - predicted) / size;
      maxErr = Math.max(maxErr, Number.isFinite(err) ? err : Infinity);
    });
  }
  return maxErr;
}

/** Finite-difference coefficients at x0 plus a linearity check at random points. */
export function extractLinear(evaluate: Evaluate, x0: number[], box: Box, probes = 6) {
  const f0 = evaluate(x0);
  const grads = x0.map((_, j) => {
    const x = [...x0];
    x[j] += 1; // step 1 is exact for linear models and kind to integer models
    const f = evaluate(x);
    return f.map((v, i) => v - f0[i]);
  });
  const coef = f0.map((_, i) => x0.map((__, j) => grads[j][i])); // coef[row][var]
  const constant = f0.map((v, i) => v - coef[i].reduce((s, c, j) => s + c * x0[j], 0));
  const rnd = probeRng(12345);
  const points = Array.from({ length: probes }, () => box.map((b) => b.lo + rnd() * (b.hi - b.lo)));
  return { coef, constant, maxErr: gapAt(evaluate, { coef, constant }, points) };
}

/** Excel re-checks linearity at the final point: the linear model against the sheet at the answer, along the way from
 *  the start and at random points of the box the two span. */
export function linearityGap(evaluate: Evaluate, lin: Linearised, x0: number[], x1: number[], probes = 6): number {
  const rnd = probeRng(54321);
  const points = [x1, ...[0.25, 0.5, 0.75].map((t) => x0.map((v, j) => v + t * (x1[j] - v)))];
  for (let k = 0; k < probes; k++) points.push(x0.map((v, j) => Math.min(v, x1[j]) + rnd() * Math.abs(x1[j] - v)));
  return gapAt(evaluate, lin, points, true);
}

interface LpOutcome { status: SolverResult['status']; method: SolverResult['method']; x?: number[]; stopped?: boolean; withinTolerance?: boolean }
type LpAnswer = { feasible: boolean; bounded?: boolean; isIntegral?: boolean; result?: number; [k: string]: unknown };

/** The LP (relaxed: integer and binary variables continuous, binaries kept within 0..1). */
function lpModel(spec: SolverSpec, lin: Linearised, relaxed: boolean): LpModel {
  const nonNeg = spec.nonNegative ?? true;
  const isBin = new Set(spec.binary ?? []);
  const isInt = new Set(spec.integer ?? []);
  const model: LpModel = { optimize: 'obj', opType: spec.sense, constraints: {}, variables: {}, ints: {}, binaries: {}, unrestricted: {} };
  spec.constraints.forEach((c, i) => {
    const bound = -lin.constant[i + 1]; // a.x + d REL 0  ->  a.x REL -d
    model.constraints[`c${i}`] = c.relation === '<=' ? { max: bound } : c.relation === '>=' ? { min: bound } : { equal: bound };
  });
  spec.changing.forEach((cellName, j) => {
    const column: Record<string, number> = { obj: lin.coef[0][j] };
    spec.constraints.forEach((_, i) => { column[`c${i}`] = lin.coef[i + 1][j]; });
    const b = spec.bounds?.[cellName];
    if (b?.hi !== undefined) { column[`ub${j}`] = 1; model.constraints[`ub${j}`] = { max: b.hi }; }
    if (b?.lo !== undefined && b.lo !== 0) { column[`lb${j}`] = 1; model.constraints[`lb${j}`] = { min: b.lo }; }
    if (relaxed && isBin.has(cellName)) { column[`bin${j}`] = 1; model.constraints[`bin${j}`] = { max: 1 }; }
    model.variables[`x${j}`] = column;
    if (!relaxed && isInt.has(cellName)) model.ints![`x${j}`] = 1;
    if (!relaxed && isBin.has(cellName)) model.binaries![`x${j}`] = 1;
    if (!nonNeg && !isBin.has(cellName)) model.unrestricted![`x${j}`] = 1;
  });
  return model;
}

/** Simplex, or branch and cut for whole-number variables: it stops at the deadline with the best whole-number answer
 *  so far (none yet: not-converged) and, with an integerTolerance, as soon as an answer is within that gap of the LP
 *  bound. Without a whole-number answer and with time left the model has none: infeasible. */
function solveLp(spec: SolverSpec, lin: Linearised): LpOutcome {
  const whole = (spec.integer?.length ?? 0) + (spec.binary?.length ?? 0) > 0;
  const method = whole ? 'branch-and-cut' : 'simplex';
  const tolerance = whole ? Math.max(0, spec.integerTolerance ?? 0) : 0;
  const model = lpModel(spec, lin, false);
  if (spec.deadline !== undefined) model.timeout = Math.max(1, Math.round(spec.deadline - performance.now()));
  if (tolerance > 0) model.tolerance = tolerance;
  // branch and cut stops at its own Date.now() + timeout, up to ~1.5 ms before the deadline: judge it by that clock
  const started = Date.now();
  const res = solver.Solve(model) as LpAnswer;
  const stopped = whole && model.timeout !== undefined && Date.now() >= started + model.timeout;
  if (res.bounded === false && res.feasible) return { status: 'unbounded', method };
  if (!res.feasible || (whole && !res.isIntegral)) return stopped ? { status: 'not-converged', method, stopped } : { status: 'infeasible', method };
  const x = spec.changing.map((_, j) => (typeof res[`x${j}`] === 'number' ? (res[`x${j}`] as number) : 0));
  if (stopped) return { status: 'optimal', method, x, stopped };
  if (tolerance > 0 && typeof res.result === 'number') {
    const bound = (solver.Solve(lpModel(spec, lin, true)) as LpAnswer).result;
    const gap = typeof bound === 'number' ? Math.abs(bound - res.result) : 0;
    if (gap > 1e-9 * (1 + Math.abs(res.result))) return { status: 'optimal', method, x, withinTolerance: true };
  }
  return { status: 'optimal', method, x };
}

/** Starting values (the cells, unless given) and the search box: explicit bounds, else 0 (non-negative) or a box
 *  around the start. */
function startAndBox(hf: HyperFormula, spec: SolverSpec, vars: SimpleCellAddress[], start?: number[]): { x0: number[]; box: Box } {
  const nonNeg = spec.nonNegative ?? true;
  const isBin = new Set(spec.binary ?? []);
  const x0 = vars.map((v, j) => { const x = start ? start[j] : num(hf, v); return Number.isFinite(x) ? (nonNeg ? Math.max(0, x) : x) : 0; });
  const box = spec.changing.map((name, j) => {
    const b = spec.bounds?.[name] ?? {};
    const lo = b.lo ?? (isBin.has(name) || nonNeg ? 0 : x0[j] - 10 - Math.abs(x0[j]));
    const hi = b.hi ?? (isBin.has(name) ? 1 : Math.max(lo + 10, x0[j] + 10 + 2 * Math.abs(x0[j])));
    return { lo, hi };
  });
  return { x0, box };
}

/** The box widened (where no explicit bound holds it) to take in the given points with some room around them. */
function boxAround(spec: SolverSpec, box: Box, points: number[][]): Box {
  const nonNeg = spec.nonNegative ?? true;
  const isBin = new Set(spec.binary ?? []);
  return box.map((b, j) => {
    const name = spec.changing[j];
    const own = spec.bounds?.[name] ?? {};
    const xs = points.map((p) => p[j]).filter((v) => Number.isFinite(v));
    if (!xs.length || isBin.has(name)) return b;
    const top = Math.max(...xs);
    const bottom = Math.min(...xs);
    return {
      lo: own.lo ?? (nonNeg ? b.lo : Math.min(b.lo, bottom - 10 - Math.abs(bottom))),
      hi: own.hi ?? Math.max(b.hi, top + 10 + Math.abs(top)),
    };
  });
}

/** Solve like Excel Solver and leave the best solution in the changing cells (as Excel's "Keep Solver Solution"). */
export function solve(hf: HyperFormula, spec: SolverSpec): SolverResult {
  const t0 = performance.now();
  const { vars, evaluate, assess, count } = makeEvaluator(hf, spec);
  const { x0, box } = startAndBox(hf, spec, vars);
  const lin = extractLinear(evaluate, x0, box);
  const linearAtStart = lin.maxErr <= LINEAR_TOLERANCE;
  let linear = linearAtStart;
  let maxErr = lin.maxErr;
  let status: SolverResult['status'] = 'optimal';
  let method: SolverResult['method'] = 'simplex';
  let x: number[] = x0;
  let lpPoint: number[] | undefined;
  let stopped = false;
  let withinTolerance = false;

  if (linear) {
    const lp = solveLp(spec, lin);
    method = lp.method;
    status = lp.status;
    stopped = lp.stopped === true;
    withinTolerance = lp.withinTolerance === true;
    if (lp.x) {
      // the probes only saw the start's neighbourhood: check the answer (and the way to it) against the sheet
      const gap = linearityGap(evaluate, lin, x0, lp.x);
      maxErr = Math.max(maxErr, gap);
      if (gap > LINEAR_TOLERANCE) {
        linear = false;
        lpPoint = lp.x;
        withinTolerance = false;
      } else x = lp.x;
    }
  }
  const flags = () => ({ ...(stopped ? { stopped } : {}), ...(withinTolerance ? { withinTolerance } : {}) });
  if (!linear && spec.linearOnly) {
    const f = evaluate(x0);
    return { status: 'not-converged', method, objective: f[0], values: valuesOf(spec, x0), linear, linearAtStart, maxLinearityError: maxErr, evaluations: count(), ms: performance.now() - t0, ...flags() };
  }
  if (!linear) {
    method = 'nelder-mead';
    const integerMask = integerMaskOf(spec);
    const searchBox = lpPoint ? boxAround(spec, box, [lpPoint]) : box;
    const out = nonlinearSearch(evaluate, spec, searchBox, x0, integerMask, { extraStarts: lpPoint ? [lpPoint] : [], deadline: spec.deadline });
    stopped ||= out.stopped;
    x = out.x;
    status = out.feasible ? 'optimal' : 'not-converged';
    if (lpPoint) {
      // the LP answer is still a plan: keep it when it meets every constraint and the search did no better
      const lp = assess(lpPoint);
      const found = out.feasible ? assess(x).objective : NaN;
      const better = !Number.isFinite(found) || (spec.sense === 'max' ? lp.objective > found : lp.objective < found);
      if (lp.violation <= FEASIBLE_TOLERANCE && Number.isFinite(lp.objective) && better) {
        x = lpPoint;
        status = 'optimal';
      }
    }
  }
  const final = evaluate(x);
  return { status, method, objective: final[0], values: valuesOf(spec, x), linear, linearAtStart, maxLinearityError: maxErr, evaluations: count(), ms: performance.now() - t0, ...flags() };
}

const valuesOf = (spec: SolverSpec, x: number[]): Record<string, number> => Object.fromEntries(spec.changing.map((c, j) => [c, x[j]]));
const integerMaskOf = (spec: SolverSpec): boolean[] => {
  const whole = new Set([...(spec.integer ?? []), ...(spec.binary ?? [])]);
  return spec.changing.map((c) => whole.has(c));
};

/** Quick multi-start search (Solver's Multistart): the non-linear search from the given points and from points spread
 *  over the box they span (explicit bounds kept). Returns the best point that meets every constraint (scaled breach at
 *  most 1e-6), or undefined when none does; the cells are left at the last point tried, so the caller restores them.
 *  At spec.deadline it stops with the best point so far (stopped). */
export function multiStart(hf: HyperFormula, spec: SolverSpec, anchors: number[][], opts: { spread?: number; seed?: number; maxEvaluations?: number } = {}): SolverResult | undefined {
  const t0 = performance.now();
  const { vars, evaluate, assess, count } = makeEvaluator(hf, spec);
  const points = anchors.filter((a) => a.length === vars.length && a.every((v) => Number.isFinite(v)));
  const { box: own } = startAndBox(hf, spec, vars, points[0]); // the first anchor is the user's start
  const box = boxAround(spec, own, points);
  const rnd = probeRng(opts.seed ?? 2024);
  const starts = [...points, box.map((b) => (b.lo + b.hi) / 2)];
  for (let k = 0; k < (opts.spread ?? Math.min(8, 3 + vars.length)); k++) starts.push(box.map((b) => b.lo + rnd() * (b.hi - b.lo)));
  const integerMask = integerMaskOf(spec);
  let best: { x: number[]; objective: number } | undefined;
  let stopped = false;
  for (const s of starts) {
    if (count() > (opts.maxEvaluations ?? 8000)) break; // quick: a few thousand recalculations at most
    if (late(spec.deadline)) { stopped = true; break; }
    const out = nonlinearSearch(evaluate, spec, box, s, integerMask, { rounds: 4, iterations: 300, single: true, deadline: spec.deadline });
    stopped ||= out.stopped;
    const a = assess(out.x);
    const meets = a.violation <= FEASIBLE_TOLERANCE && Number.isFinite(a.objective);
    if (meets && (!best || (spec.sense === 'max' ? a.objective > best.objective : a.objective < best.objective))) best = { x: out.x, objective: a.objective };
    if (stopped) break;
  }
  if (!best) return undefined;
  const final = evaluate(best.x);
  return { status: 'optimal', method: 'nelder-mead', objective: final[0], values: valuesOf(spec, best.x), linear: false, linearAtStart: false, maxLinearityError: NaN, evaluations: count(), ms: performance.now() - t0, ...(stopped ? { stopped } : {}) };
}

/** Augmented-Lagrangian wrapper around bounded Nelder-Mead (constraints scaled by 1 + |g(x0)|) over the free variables
 *  (bounds that meet fix a variable). Every start is moved into the box and the first simplex steps into it: from a start
 *  on an upper bound typed as a number (E4 <= 10 with E4 = 10) the usual outward step was clamped back onto the start, the
 *  simplex collapsed and the search never left the corner. At the deadline it stops (stopped); when its last point breaks
 *  a constraint, the best point that met them all is returned instead. */
function nonlinearSearch(evaluate: Evaluate, spec: SolverSpec, box: Box, x0: number[], integerMask: boolean[], opts: { extraStarts?: number[][]; rounds?: number; iterations?: number; single?: boolean; deadline?: number } = {}) {
  const sign = spec.sense === 'max' ? -1 : 1;
  const snap = (v: number[]) => v.map((xi, j) => {
    const c = Math.min(box[j].hi, Math.max(box[j].lo, xi));
    return integerMask[j] ? Math.round(c) : c;
  });
  const free = box.flatMap((b, j) => (b.hi > b.lo ? [j] : []));
  const origin = snap(x0);
  const full = (z: number[]) => { const v = [...origin]; free.forEach((j, k) => { v[j] = z[k]; }); return v; };
  const part = (v: number[]) => free.map((j) => v[j]);
  const g0 = evaluate(origin);
  // extra starts (an LP answer) also size the objective, so a start where it is 0 does not drown the constraints
  const fScale = 1 + Math.max(Math.abs(g0[0]), ...(opts.extraStarts ?? []).map((p) => Math.abs(evaluate(snap(p))[0])).filter((v) => Number.isFinite(v)));
  const gScale = spec.constraints.map((_, i) => 1 + Math.abs(g0[i + 1]));
  // every constraint as h(x) <= 0 (inequality) or e(x) = 0 (equality), normalised
  const residuals = (f: number[]) => spec.constraints.map((c, i) => (c.relation === '>=' ? -f[i + 1] : f[i + 1]) / gScale[i]);
  const lambda = spec.constraints.map(() => 0);
  let mu = 10;
  const merit = (v: number[]) => {
    const f = evaluate(snap(v));
    if (!Number.isFinite(f[0])) return Infinity;
    let L = (sign * f[0]) / fScale;
    residuals(f).forEach((r, i) => {
      if (spec.constraints[i].relation === '=') L += lambda[i] * r + (mu / 2) * r * r;
      else L += (mu / 2) * Math.max(0, r + lambda[i] / mu) ** 2 - (lambda[i] * lambda[i]) / (2 * mu);
    });
    return L;
  };
  const violation = (f: number[]) => Math.max(0, ...residuals(f).map((r, i) => (spec.constraints[i].relation === '=' ? Math.abs(r) : Math.max(0, r))));
  const meets = (f: number[]) => spec.constraints.every((c, i) => {
    const g = f[i + 1];
    const tol = FEASIBLE_TOLERANCE * gScale[i];
    return c.relation === '<=' ? g <= tol : c.relation === '>=' ? g >= -tol : Math.abs(g) <= tol;
  });
  let x = origin;
  let lastViolation = Infinity;
  let bestMet: { x: number[]; objective: number } | undefined;
  let stopped = false;
  const widths = box.map((b) => 0.1 * (b.hi - b.lo) || 1);
  // the first simplex steps up from each start, or down where up would leave the box
  const stepsFrom = (s: number[], scale: number) => free.map((j) => (s[j] + widths[j] * scale <= box[j].hi ? 1 : -1) * widths[j] * scale);
  const first = (opts.single ? [x0] : [x0, box.map((b) => (b.lo + b.hi) / 2), box.map((b) => b.lo + 0.25 * (b.hi - b.lo)), ...(opts.extraStarts ?? [])]).map(snap);
  for (let outer = 0; outer < (opts.rounds ?? 12) && free.length > 0; outer++) {
    const starts = outer === 0 ? first : [x];
    let best = { x, fx: merit(x) };
    for (const s of starts) {
      if (late(opts.deadline)) break;
      const r = nelderMead((z) => merit(full(z)), part(s), { step: stepsFrom(s, outer === 0 ? 1 : 0.1), maxIterations: opts.iterations ?? 800, tolerance: 1e-12, deadline: opts.deadline });
      if (r.fx < best.fx) best = { x: full(r.x), fx: r.fx };
    }
    x = snap(best.x);
    const f = evaluate(x);
    if (Number.isFinite(f[0]) && meets(f) && (!bestMet || sign * f[0] < sign * bestMet.objective)) bestMet = { x, objective: f[0] };
    if (late(opts.deadline)) { stopped = true; break; }
    const res = residuals(f);
    res.forEach((r, i) => { lambda[i] = spec.constraints[i].relation === '=' ? lambda[i] + mu * r : Math.max(0, lambda[i] + mu * r); });
    const viol = violation(f);
    if (viol <= 1e-9) { if (outer > 0) break; } else if (viol > 0.25 * lastViolation) mu *= 10;
    lastViolation = viol;
  }
  let feasible = meets(evaluate(x));
  if (!feasible && bestMet) {
    x = bestMet.x;
    feasible = true;
  }
  return { x, feasible, stopped };
}
