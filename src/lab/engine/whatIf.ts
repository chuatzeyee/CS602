// whatIf.ts - Excel "What-If Analysis" emulation on HyperFormula: Goal Seek, Data Tables (1- and
// 2-variable) and iterative calculation for circular references.
import type { HyperFormula, SimpleCellAddress } from 'hyperformula';
import { addr, readCell } from './workbook.ts';
import type { CellInput, Lab } from './workbook.ts';

function valueAt(hf: HyperFormula, at: SimpleCellAddress): number {
  const r = readCell(hf, at);
  return r.kind === 'number' ? r.value : r.kind === 'empty' ? 0 : r.kind === 'boolean' ? Number(r.value) : NaN;
}
function put(hf: HyperFormula, at: SimpleCellAddress, v: CellInput): void { hf.setCellContents(at, [[v]]); }

export interface GoalSeekResult { found: boolean; input: number; output: number; iterations: number; method: string }

/** Goal Seek: change `byChanging` (a constant cell) until `setCell` equals `toValue`.
 *  Secant steps from the current value; once a sign change is bracketed it switches to the Illinois
 *  method (regula falsi that halves the stale end), which cannot escape the bracket.
 *  Like Excel, the changing cell keeps the answer (pass restore=true to put the old value back). */
export function goalSeek(hf: HyperFormula, opts: {
  setCell: string; toValue: number; byChanging: string; sheet?: string;
  tolerance?: number; maxIterations?: number; restore?: boolean;
}): GoalSeekResult {
  const target = addr(hf, opts.setCell, opts.sheet);
  const input = addr(hf, opts.byChanging, opts.sheet);
  if (hf.doesCellHaveFormula(input)) throw new Error('Goal Seek: the changing cell must contain a value, not a formula');
  const tol = opts.tolerance ?? 1e-7;
  const maxIt = opts.maxIterations ?? 100;
  const original = valueAt(hf, input);
  const f = (x: number): number => { put(hf, input, x); return valueAt(hf, target) - opts.toValue; };

  const close = (fx: number) => Number.isFinite(fx) && Math.abs(fx) <= tol * Math.max(1, Math.abs(opts.toValue));
  let x0 = Number.isFinite(original) ? original : 0;
  let f0 = f(x0);
  let x1 = x0 === 0 ? 0.01 : x0 * 1.01;
  let f1 = f(x1);
  let bracketed = false; // once f changes sign: Illinois (safeguarded regula falsi) keeps the root bracketed
  let it = 0;
  let method = 'secant';
  for (; it < maxIt && !close(f1); it++) {
    if (!bracketed && Number.isFinite(f0) && Number.isFinite(f1) && Math.sign(f0) !== Math.sign(f1)) bracketed = true;
    let x2: number;
    if (bracketed) {
      method = 'secant+illinois';
      x2 = (x0 * f1 - x1 * f0) / (f1 - f0);
    } else {
      const slope = (f1 - f0) / (x1 - x0);
      x2 = Number.isFinite(slope) && slope !== 0 ? x1 - f1 / slope : x1 + (x1 - x0) * 2; // flat/error: step out
      if (!Number.isFinite(x2)) x2 = x1 * 2 + 1;
    }
    const f2 = f(x2);
    if (bracketed && Math.sign(f2) === Math.sign(f1)) { f0 /= 2; } else { x0 = x1; f0 = f1; } // Illinois step
    x1 = x2; f1 = f2;
    if (bracketed && Math.abs(x1 - x0) <= 1e-13 * Math.max(1, Math.abs(x1))) break;
  }
  const found = Number.isFinite(f1) && Math.abs(f1) <= Math.max(tol * Math.max(1, Math.abs(opts.toValue)), 1e-9);
  const result = { found, input: x1, output: f1 + opts.toValue, iterations: it, method };
  if (opts.restore || !found) put(hf, input, original);
  return result;
}

/** One-variable Data Table: for each value put it in `inputCell`, read every output cell.
 *  Excel recalculates RAND() for each substitution - pass the Lab with redrawEach=true to mimic. */
export function dataTable1(lab: Lab, opts: { inputCell: string; values: number[]; outputs: string[]; sheet?: string; redrawEach?: boolean }): number[][] {
  const { hf } = lab;
  const input = addr(hf, opts.inputCell, opts.sheet);
  const outs = opts.outputs.map((o) => addr(hf, o, opts.sheet));
  const original = hf.getCellSerialized(input) as CellInput;
  const rows = opts.values.map((v) => {
    if (opts.redrawEach) lab.random?.redraw();
    put(hf, input, v);
    return outs.map((o) => valueAt(hf, o));
  });
  put(hf, input, original);
  return rows;
}

/** Two-variable Data Table: rows vary `rowInput`, columns vary `colInput`, one output cell. */
export function dataTable2(lab: Lab, opts: {
  rowInput: string; rowValues: number[]; colInput: string; colValues: number[]; output: string; sheet?: string; redrawEach?: boolean;
}): number[][] {
  const { hf } = lab;
  const rIn = addr(hf, opts.rowInput, opts.sheet);
  const cIn = addr(hf, opts.colInput, opts.sheet);
  const out = addr(hf, opts.output, opts.sheet);
  const keepR = hf.getCellSerialized(rIn) as CellInput;
  const keepC = hf.getCellSerialized(cIn) as CellInput;
  const grid = opts.rowValues.map((rv) => opts.colValues.map((cv) => {
    if (opts.redrawEach) lab.random?.redraw();
    hf.batch(() => { put(hf, rIn, rv); put(hf, cIn, cv); }); // one recalculation for both inputs
    return valueAt(hf, out);
  }));
  hf.batch(() => { put(hf, rIn, keepR); put(hf, cIn, keepC); });
  return grid;
}

/** Excel "Enable iterative calculation" for a circular model: the listed cells keep their formulas
 *  as text, hold values, and are updated Gauss-Seidel style until the largest change <= maxChange. */
export function iterateCircular(hf: HyperFormula, cells: string[], opts: { sheet?: string; maxIterations?: number; maxChange?: number } = {}): { converged: boolean; iterations: number; values: number[]; formulas: string[] } {
  const at = cells.map((c) => addr(hf, c, opts.sheet));
  const formulas = at.map((a) => hf.getCellFormula(a));
  if (formulas.some((f) => f === undefined)) throw new Error('iterateCircular: every listed cell must hold a formula');
  const maxIt = opts.maxIterations ?? 100; // Excel defaults: 100 iterations, maximum change 0.001
  const maxChange = opts.maxChange ?? 0.001;
  hf.batch(() => at.forEach((a) => put(hf, a, 0))); // break the cycle, start from 0 like Excel
  let values = at.map(() => 0);
  let it = 0;
  let converged = false;
  while (it < maxIt && !converged) {
    it += 1;
    let delta = 0;
    values = at.map((a, i) => {
      const v = hf.calculateFormula(formulas[i] as string, a.sheet);
      const num = typeof v === 'number' ? v : NaN;
      delta = Math.max(delta, Math.abs(num - values[i]));
      put(hf, a, Number.isFinite(num) ? num : 0);
      return num;
    });
    converged = delta <= maxChange;
  }
  return { converged, iterations: it, values, formulas: formulas as string[] }; // keep formulas to show/restore in the UI
}
