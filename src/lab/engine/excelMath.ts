// excelMath.ts - pure, engine-independent implementations of Excel behaviours that HyperFormula 3.5
// lacks or gets wrong. Unit-tested in engine.test.ts and engine-fixes.test.ts. Only depends on dateText.ts.
import { parseDateText, parseTimeText } from './dateText.ts';
import { excelWildcard, type WildcardMatcher } from './glob.ts';

export type RoundMode = 'nearest' | 'up' | 'down';

/** Move the decimal point `digits` places without binary noise (works on the decimal string). */
function shiftDecimal(x: number, digits: number): number {
  const [mantissa, exponent = '0'] = x.toString().split('e');
  return Number(`${mantissa}e${Number(exponent) + digits}`);
}

/** Excel ROUND / ROUNDUP / ROUNDDOWN: half away from zero, on the 15-significant-digit value. */
export function excelRound(x: number, digits: number, mode: RoundMode): number {
  if (!Number.isFinite(x)) return x;
  const d = Math.trunc(digits);
  const sign = x < 0 ? -1 : 1;
  const shifted = shiftDecimal(Number(Math.abs(x).toPrecision(15)), d);
  const whole = mode === 'nearest' ? Math.round(shifted) : mode === 'up' ? Math.ceil(shifted) : Math.floor(shifted);
  return sign * shiftDecimal(whole, -d) + 0; // "+ 0" normalises -0
}

/** Standard normal CDF, double precision (W. J. Cody / Hart 5666 as given by G. West, 2005). */
export function normSDist(x: number): number {
  const z = Math.abs(x);
  let tail = 0;
  if (z <= 37) {
    const e = Math.exp((-z * z) / 2);
    if (z < 7.07106781186547) {
      let n = 3.52624965998911e-2 * z + 0.700383064443688;
      n = n * z + 6.37396220353165; n = n * z + 33.912866078383; n = n * z + 112.079291497871;
      n = n * z + 221.213596169931; n = n * z + 220.206867912376;
      let d = 8.83883476483184e-2 * z + 1.75566716318264;
      d = d * z + 16.064177579207; d = d * z + 86.7807322029461; d = d * z + 296.564248779674;
      d = d * z + 637.333633378831; d = d * z + 793.826512519948; d = d * z + 440.413735824752;
      tail = (e * n) / d;
    } else {
      let f = z + 0.65;
      f = z + 4 / f; f = z + 3 / f; f = z + 2 / f; f = z + 1 / f;
      tail = e / f / 2.506628274631;
    }
  }
  return x <= 0 ? tail : 1 - tail;
}

/** Parse what a user types or what VALUE() receives: "12%", "$1,200", "(1,200.50)", "1.2e3". */
export function parseLooseNumber(input: string): number | undefined {
  let s = input.trim();
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1).trim(); }
  let scale = 1;
  if (s.endsWith('%')) { scale = 0.01; s = s.slice(0, -1).trim(); }
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1).trim(); } else if (s.startsWith('+')) { s = s.slice(1).trim(); }
  s = s.replace(/^(S\$|US\$|\$|€|£)\s*/, '');
  if (!/^(\d{1,3}(,\d{3})+|\d*)(\.\d*)?([eE][-+]?\d+)?$/.test(s) || !/\d/.test(s)) return undefined;
  const value = Number(s.replace(/,/g, '')) * scale;
  return negative ? -value : value;
}

export type Cell = number | string | boolean | null;
/** An error value inside a range a criterion is tested against, e.g. { error: '#N/A' }. */
export interface CellErrorValue { error: string }
export type CriteriaCell = Cell | CellErrorValue;

/** HyperFormula's tolerant number comparison (relative 1e-13), used by its criteria and lookups. */
export function floatCmp(a: number, b: number, eps = 1e-13): -1 | 0 | 1 {
  const mod = 1 + eps;
  if (b >= 0 && a * mod >= b && a <= b * mod) return 0;
  if (b <= 0 && a * mod <= b && a >= b * mod) return 0;
  return a > b ? 1 : -1;
}

/** Excel wildcards (* any run, ? one character, ~* ~? ~~ literal) as a whole-text, case-insensitive matcher (glob.ts:
 *  no RegExp, so a pattern with many stars cannot freeze the page). */
export function wildcardRegExp(pattern: string): WildcardMatcher {
  return excelWildcard(pattern, 'whole');
}

export type CriterionOperator = '' | '=' | '<>' | '<' | '<=' | '>' | '>=';
export type CriterionOperand =
  | { kind: 'empty' }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'error'; code: string }
  | { kind: 'text'; text: string };
export interface Criterion { op: CriterionOperator; operand: CriterionOperand }

const ERROR_CODES = ['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#SPILL!', '#CALC!', '#CYCLE!', '#ERROR!'];

/** Text that Excel reads as a number: 12, 12%, $1,200, (5), 1E3, 29 Jun 2026, 29/06/2026, 2026-06-29, 6:45 PM. */
export function numericText(text: string): number | undefined {
  const t = text.trim();
  if (t === '') return undefined;
  const n = parseLooseNumber(t);
  if (n !== undefined) return Number.isFinite(n) ? n : undefined;
  return (parseDateText(t) ?? parseTimeText(t))?.value;
}

/** The value part of a criterion string, read like a typed entry; anything else is text (wildcards allowed). */
export function criterionOperand(text: string): CriterionOperand {
  if (text === '') return { kind: 'empty' };
  const t = text.trim();
  if (/^(true|false)$/i.test(t)) return { kind: 'boolean', value: t.toUpperCase() === 'TRUE' };
  if (ERROR_CODES.includes(t.toUpperCase())) return { kind: 'error', code: t.toUpperCase() };
  const n = numericText(t);
  return n === undefined ? { kind: 'text', text } : { kind: 'number', value: n };
}

/** Excel criteria (COUNTIF family): 7, TRUE, ">=5", "<>North", "Ea*", "", "=", "<>", ">=29 Jun 2026", ">x".
 *  A reference to an empty cell (null/undefined) means 0. */
export function parseCriterion(criterion: Cell | undefined): Criterion {
  if (criterion === null || criterion === undefined) return { op: '=', operand: { kind: 'number', value: 0 } };
  if (typeof criterion === 'number') return { op: '=', operand: { kind: 'number', value: criterion } };
  if (typeof criterion === 'boolean') return { op: '=', operand: { kind: 'boolean', value: criterion } };
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(criterion);
  return { op: (m?.[1] ?? '') as CriterionOperator, operand: criterionOperand(m?.[2] ?? '') };
}

const textOrder = new Intl.Collator('en', { sensitivity: 'accent' });
const isErrorValue = (v: CriteriaCell): v is CellErrorValue => v !== null && typeof v === 'object';

function equalTo(operand: CriterionOperand, bare: boolean): (v: CriteriaCell) => boolean {
  switch (operand.kind) {
    case 'empty': // "" also matches empty text from a formula; "=" only truly empty cells
      return bare ? (v) => v === null || v === '' : (v) => v === null;
    case 'number':
      return (v) => {
        if (typeof v === 'number') return floatCmp(v, operand.value) === 0;
        const n = typeof v === 'string' ? numericText(v) : undefined; // numbers stored as text match too
        return n !== undefined && floatCmp(n, operand.value) === 0;
      };
    case 'boolean':
      return (v) => v === operand.value;
    case 'error':
      return (v) => isErrorValue(v) && v.error === operand.code;
    case 'text': {
      const re = wildcardRegExp(operand.text);
      return (v) => typeof v === 'string' && re.test(v);
    }
  }
}

/** Matcher for one Excel criterion; ordering operators compare numbers with numbers and text with text. */
export function makeCriterion(criterion: Cell | undefined): (value: CriteriaCell) => boolean {
  const { op, operand } = parseCriterion(criterion);
  const equals = equalTo(operand, op === '');
  if (op === '' || op === '=') return equals;
  if (op === '<>') return (v) => !equals(v);
  const holds = (c: number) => (op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0);
  if (operand.kind === 'number') return (v) => typeof v === 'number' && holds(floatCmp(v, operand.value));
  if (operand.kind === 'text') return (v) => typeof v === 'string' && holds(textOrder.compare(v, operand.text));
  if (operand.kind === 'boolean') return (v) => typeof v === 'boolean' && holds(Number(v) - Number(operand.value));
  return () => false;
}

/** Number -> text the way Excel joins it with & or TEXT(...,"General"): up to 15 significant digits. */
export function excelNumberText(n: number): string {
  if (!Number.isFinite(n)) return '#NUM!';
  const r = Number(n.toPrecision(15));
  if (r === 0) return '0';
  const abs = Math.abs(r);
  if (abs < 1e15 && abs >= 1e-5) return String(r);
  const [mantissa, exp] = r.toExponential(14).split('e');
  const m = mantissa.includes('.') ? mantissa.replace(/\.?0+$/, '') : mantissa;
  const e = Number(exp);
  return `${m}E${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;
}

/** log Gamma (Lanczos, g = 7), for binomial terms far from 0. */
function logGamma(x: number): number {
  const g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let a = g[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += g[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Excel BINOM.INV / CRITBINOM: smallest k with P(X <= k) >= alpha, X ~ Binomial(trials, p); alpha 0 gives 0. */
export function binomInv(trials: number, p: number, alpha: number): number | 'NUM' {
  const n = Math.trunc(trials);
  if (!Number.isFinite(n) || n < 0 || !(p >= 0 && p <= 1) || !(alpha >= 0 && alpha <= 1)) return 'NUM';
  if (alpha === 0 || p === 0) return 0;
  if (p === 1 || alpha === 1) return n;
  const q = 0.5 - p + 0.5;
  // huge trials: skip the far lower tail (its mass is far under 1e-20) so the loop stays short
  const start = n > 1e5 ? Math.max(0, Math.floor(n * p - 12 * Math.sqrt(n * p * q) - 12)) : 0;
  const ratio = Math.log(p) - Math.log(q);
  let logPmf = start === 0 ? n * Math.log1p(-p)
    : logGamma(n + 1) - logGamma(start + 1) - logGamma(n - start + 1) + start * Math.log(p) + (n - start) * Math.log(q);
  let cdf = 0;
  for (let k = start; k < n; k++) {
    cdf += Math.exp(logPmf);
    if (cdf >= alpha) return k;
    logPmf += Math.log((n - k) / (k + 1)) + ratio;
  }
  return n;
}

/** Excel PERCENTRANK / PERCENTRANK.INC (interpolates between data points, truncates to `significance`). */
export function percentRankInc(data: number[], x: number, significance = 3): number | 'NA' | 'NUM' {
  if (significance < 1 || data.length === 0) return 'NUM';
  const s = [...data].sort((a, b) => a - b);
  const n = s.length;
  if (x < s[0] || x > s[n - 1]) return 'NA';
  if (n === 1) return 1;
  const rankOf = (v: number): number => s.filter((d) => d < v).length / (n - 1);
  let value: number;
  if (s.includes(x)) {
    value = rankOf(x);
  } else {
    const hi = s.findIndex((d) => d > x);
    const lo = s[hi - 1];
    value = rankOf(lo) + ((x - lo) / (s[hi] - lo)) * (rankOf(s[hi]) - rankOf(lo));
  }
  const p = 10 ** Math.trunc(significance);
  return Math.floor(Number((value * p).toPrecision(12))) / p;
}

/** Excel RANK / RANK.EQ: order 0 (default) = descending. */
export function rankEq(x: number, data: number[], ascending: boolean): number | 'NA' {
  if (!data.includes(x)) return 'NA';
  return 1 + data.filter((d) => (ascending ? d < x : d > x)).length;
}

/** Excel MODE / MODE.SNGL: most frequent value, ties -> first in data order; no repeats -> #N/A. */
export function modeSngl(data: number[]): number | 'NA' {
  const counts = new Map<number, number>();
  for (const d of data) counts.set(d, (counts.get(d) ?? 0) + 1);
  let best: number | undefined;
  let bestCount = 1;
  for (const d of data) {
    const c = counts.get(d) ?? 0;
    if (c > bestCount) { best = d; bestCount = c; }
  }
  return best === undefined ? 'NA' : best;
}

/** Excel FREQUENCY: counts per bin (value <= bin and > previous bin) plus an overflow bucket. */
export function frequency(data: number[], bins: number[]): number[] {
  const order = bins.map((b, i) => ({ b, i })).sort((p, q) => p.b - q.b);
  const counts = new Array<number>(bins.length + 1).fill(0);
  for (const v of data) {
    const slot = order.find((o) => v <= o.b);
    counts[slot ? slot.i : bins.length] += 1;
  }
  return counts;
}

/** Least-squares line y = intercept + slope * x (const=false forces the line through the origin). */
export function linearFit(ys: number[], xs: number[], withConstant = true): { slope: number; intercept: number } | 'DIV0' {
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return 'DIV0';
  if (!withConstant) {
    const sxx0 = xs.reduce((s, x) => s + x * x, 0);
    return sxx0 === 0 ? 'DIV0' : { slope: xs.reduce((s, x, i) => s + x * ys[i], 0) / sxx0, intercept: 0 };
  }
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  if (sxx === 0) return 'DIV0';
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

/** Excel approximate-match position (LOOKUP / MATCH type 1): last item <= target in ascending data. */
export function approxMatchIndex(values: Cell[], target: Cell): number {
  let found = -1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const comparable = typeof v === typeof target && v !== null;
    if (!comparable) continue;
    const le = typeof v === 'string' ? v.toLowerCase() <= String(target).toLowerCase() : (v as number) <= (target as number);
    if (le) found = i; else break;
  }
  return found;
}
