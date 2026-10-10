// excelPack.ts - Excel-compatibility layer for HyperFormula 3.5 (GPL-3.0 edition, licenseKey 'gpl-v3').
// Fixes: bare TRUE/FALSE literals, INT on negatives, ROUND* decimal accuracy, 1-argument NORMSDIST,
// TEXT number/date formats (format.ts on top of SheetJS SSF), VALUE("$1,200"), MATCH wildcards, DATEDIF units in any
// case, BINOM.INV/CRITBINOM with alpha 0 or 1, "" in arithmetic, 15-digit number text and text in referenced cells
// skipped by MEDIAN, NPV, AVEDEV... (coercion.ts).
// INDEX on a single-row range / with row or column 0 / on array constants (Excel 365 semantics).
// Adds: LOOKUP, TREND (known_x defaults to 1..n, spills), FORECAST(.LINEAR), INTERCEPT, FREQUENCY (spills),
// PERCENTRANK(.INC), RANK(.EQ), MODE(.SNGL), SINGLE (the @ operator, see formulaText.ts) and the COUNTIF family
// (conditional.ts).
import { ArraySize, CellError, EmptyValue, ErrorType, FunctionArgumentType, FunctionPlugin, HyperFormula, SimpleRangeValue } from 'hyperformula';
import type { ConfigParams, SerializedNamedExpression } from 'hyperformula';
import {
  approxMatchIndex, binomInv, excelRound, frequency, linearFit, modeSngl, normSDist, numericText,
  parseLooseNumber, percentRankInc, rankEq, wildcardRegExp,
} from './excelMath.ts';
import type { Cell } from './excelMath.ts';
import { formatText } from './format.ts';
import { ExcelCriteriaPlugin } from './conditional.ts';
import { patchEngineCoercion, patchReferenceArguments, patchTextArguments, patchTextLimits } from './coercion.ts';
import { MAX_TEXT, TEXT_TOO_LONG } from './limits.ts';

/** Engine options that make HyperFormula behave like desktop Excel (365). */
export const EXCEL_CONFIG: Partial<ConfigParams> = {
  licenseKey: 'gpl-v3',                         // GPL-3.0 licence -> the site repo must be GPL-3.0 too
  leapYear1900: true,                            // Excel's 1900 leap-year bug ...
  nullDate: { year: 1899, month: 12, day: 31 },  // ... so DATE(1900,1,1)=1 and DATE(1900,3,1)=61
  evaluateNullToZero: true,                      // =A1 (empty) shows 0
  useArrayArithmetic: true,                      // dynamic arrays: =SUM(IF(A1:A5>2,1,0)) without CSE
  dateFormats: ['DD/MM/YYYY', 'DD/MM/YY', 'YYYY/MM/DD'], // also accepts 2026-10-10
  timeFormats: ['hh:mm', 'hh:mm:ss.sss'],
  precisionRounding: 14,                         // default 10 hides digits students compare with Excel
};

/** Excel treats TRUE/FALSE as literals; HyperFormula only knows TRUE()/FALSE(). */
export const EXCEL_NAMED_EXPRESSIONS: SerializedNamedExpression[] = [
  { name: 'TRUE', expression: '=TRUE()' },
  { name: 'FALSE', expression: '=FALSE()' },
];

/* eslint-disable @typescript-eslint/no-explicit-any -- HF does not export its Ast/State types */
type Ast = any;
type State = any;
type Interpreter = ConstructorParameters<typeof FunctionPlugin>[0];
type Scalar = SimpleRangeValue['data'][number][number];
interface Origin { sheet: number; row: number; col: number }
interface MatchDelegate { doMatch(key: unknown, range: SimpleRangeValue, type: number): Scalar }

const { NUMBER, RANGE, SCALAR, ANY, BOOLEAN, NOERROR, STRING } = FunctionArgumentType;
const err = (t: ErrorType, msg?: string) => new CellError(t, msg);
const fromCode = (code: string): CellError => err(code === 'NA' ? ErrorType.NA : code === 'NUM' ? ErrorType.NUM : ErrorType.DIV_BY_ZERO);
const omitted = (a: Ast): boolean => a === undefined || a.type === 'EMPTY';
/** Where the row or column INDEX returned sits on the sheet, so @INDEX(...) can intersect it like a range. */
const indexOrigins = new WeakMap<SimpleRangeValue, Origin>();

/** Unwrap HF rich numbers (dates, %, currency) and the empty marker into plain JS values. */
function plain(v: unknown): Cell | CellError {
  if (v instanceof CellError) return v;
  if (v === EmptyValue || v === undefined) return null;
  if (v !== null && typeof v === 'object' && typeof (v as { val?: unknown }).val === 'number') return (v as { val: number }).val;
  return v as Cell;
}
function cellsOf(arg: unknown): (Cell | CellError)[] {
  return arg instanceof SimpleRangeValue ? arg.valuesFromTopLeftCorner().map(plain) : [plain(arg)];
}
/** Numbers in a range (text/booleans/blanks skipped like Excel's statistical functions); first error wins. */
function numbersOf(arg: unknown): number[] | CellError {
  const out: number[] = [];
  for (const v of cellsOf(arg)) {
    if (v instanceof CellError) return v;
    if (typeof v === 'number') out.push(v);
  }
  return out;
}
/** Pairs of numeric (y, x) values - TREND/FORECAST/INTERCEPT ignore pairs with a non-number. No x: 1, 2, 3, ... */
function pairs(yArg: unknown, xArg: unknown, sizeError: ErrorType): { ys: number[]; xs: number[] } | CellError {
  const y = cellsOf(yArg);
  const x = xArg === undefined ? y.map((_, i) => i + 1) : cellsOf(xArg);
  if (x.length !== y.length) return err(sizeError, 'known_y and known_x sizes differ');
  const ys: number[] = [];
  const xs: number[] = [];
  for (let i = 0; i < y.length; i++) {
    const a = y[i];
    const b = x[i];
    if (a instanceof CellError) return a;
    if (b instanceof CellError) return b;
    if (typeof a === 'number' && typeof b === 'number') { ys.push(a); xs.push(b); }
  }
  return { ys, xs };
}
const fullSize = (size: ArraySize): ArraySize => new ArraySize(size.width, size.height); // a range result spills
const startOf = (r: SimpleRangeValue): Origin | undefined => r.range?.start;

export class ExcelCompatPlugin extends FunctionPlugin {
  static implementedFunctions = {
    INT: { method: 'int', parameters: [{ argumentType: NUMBER }] },
    ROUND: { method: 'round', parameters: [{ argumentType: NUMBER }, { argumentType: NUMBER }] },
    ROUNDUP: { method: 'roundup', parameters: [{ argumentType: NUMBER }, { argumentType: NUMBER }] },
    ROUNDDOWN: { method: 'rounddown', parameters: [{ argumentType: NUMBER }, { argumentType: NUMBER }] },
    NORMSDIST: { method: 'normsdist', parameters: [{ argumentType: NUMBER }] },
    TEXT: { method: 'text', parameters: [{ argumentType: SCALAR }, { argumentType: SCALAR }] },
    VALUE: { method: 'value', parameters: [{ argumentType: SCALAR }] },
    INDEX: {
      method: 'index', sizeOfResultArrayMethod: 'indexSize', vectorizationForbidden: true,
      parameters: [{ argumentType: RANGE }, { argumentType: NUMBER, optionalArg: true }, { argumentType: NUMBER, optionalArg: true }],
    },
    SINGLE: { method: 'single', vectorizationForbidden: true, parameters: [{ argumentType: ANY }] },
    MATCH: { method: 'match', parameters: [{ argumentType: NOERROR }, { argumentType: RANGE }, { argumentType: NUMBER, defaultValue: 1 }] },
    LOOKUP: { method: 'lookup', parameters: [{ argumentType: SCALAR }, { argumentType: RANGE }, { argumentType: RANGE, optionalArg: true }] },
    TREND: {
      method: 'trend', sizeOfResultArrayMethod: 'trendSize', vectorizationForbidden: true,
      parameters: [{ argumentType: RANGE }, { argumentType: RANGE, optionalArg: true }, { argumentType: ANY, optionalArg: true }, { argumentType: BOOLEAN, defaultValue: true }],
    },
    FORECAST: { method: 'forecast', parameters: [{ argumentType: NUMBER }, { argumentType: RANGE }, { argumentType: RANGE }] },
    'FORECAST.LINEAR': { method: 'forecast', parameters: [{ argumentType: NUMBER }, { argumentType: RANGE }, { argumentType: RANGE }] },
    INTERCEPT: { method: 'intercept', parameters: [{ argumentType: RANGE }, { argumentType: RANGE }] },
    FREQUENCY: {
      method: 'frequency', sizeOfResultArrayMethod: 'frequencySize', vectorizationForbidden: true,
      parameters: [{ argumentType: RANGE }, { argumentType: RANGE }],
    },
    PERCENTRANK: { method: 'percentrank', parameters: [{ argumentType: RANGE }, { argumentType: NUMBER }, { argumentType: NUMBER, defaultValue: 3 }] },
    'PERCENTRANK.INC': { method: 'percentrank', parameters: [{ argumentType: RANGE }, { argumentType: NUMBER }, { argumentType: NUMBER, defaultValue: 3 }] },
    RANK: { method: 'rank', parameters: [{ argumentType: NUMBER }, { argumentType: RANGE }, { argumentType: NUMBER, defaultValue: 0 }] },
    'RANK.EQ': { method: 'rank', parameters: [{ argumentType: NUMBER }, { argumentType: RANGE }, { argumentType: NUMBER, defaultValue: 0 }] },
    MODE: { method: 'mode', parameters: [{ argumentType: ANY }], repeatLastArgs: 1 },
    'MODE.SNGL': { method: 'mode', parameters: [{ argumentType: ANY }], repeatLastArgs: 1 },
    'BINOM.INV': { method: 'binominv', parameters: [{ argumentType: NUMBER }, { argumentType: NUMBER }, { argumentType: NUMBER }] },
    CRITBINOM: { method: 'binominv', parameters: [{ argumentType: NUMBER }, { argumentType: NUMBER }, { argumentType: NUMBER }] },
    DATEDIF: { method: 'datedif', parameters: [{ argumentType: NUMBER, minValue: 0 }, { argumentType: NUMBER, minValue: 0 }, { argumentType: STRING }] },
    REPT: { method: 'rept', parameters: [{ argumentType: STRING }, { argumentType: NUMBER }] },
  };

  private readonly lookupDelegate?: MatchDelegate;

  constructor(interpreter: Interpreter) {
    super(interpreter);
    patchEngineCoercion(interpreter);
    // HyperFormula's own MATCH (exact, sorted and descending search) still answers everything but wildcards
    const LookupPlugin = HyperFormula.getFunctionPlugin('VLOOKUP') as unknown as (new (i: Interpreter) => MatchDelegate) | undefined;
    const delegate = LookupPlugin ? new LookupPlugin(interpreter) : undefined;
    this.lookupDelegate = typeof delegate?.doMatch === 'function' ? delegate : undefined;
  }

  int(ast: Ast, state: State) { return this.runFunction(ast.args, state, this.metadata('INT'), (x: number) => Math.floor(x)); }
  round(ast: Ast, state: State) { return this.runFunction(ast.args, state, this.metadata('ROUND'), (x: number, d: number) => excelRound(x, d, 'nearest')); }
  roundup(ast: Ast, state: State) { return this.runFunction(ast.args, state, this.metadata('ROUNDUP'), (x: number, d: number) => excelRound(x, d, 'up')); }
  rounddown(ast: Ast, state: State) { return this.runFunction(ast.args, state, this.metadata('ROUNDDOWN'), (x: number, d: number) => excelRound(x, d, 'down')); }
  normsdist(ast: Ast, state: State) { return this.runFunction(ast.args, state, this.metadata('NORMSDIST'), (z: number) => normSDist(z)); }

  /** TEXT(value, format): an empty cell is 0, numbers stored as text (or dates in words) are converted first. */
  text(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('TEXT'), (value: unknown, format: unknown) => {
      const v = plain(value);
      if (v instanceof CellError) return v;
      const f = plain(format);
      if (f instanceof CellError) return f;
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      const n = v === null ? 0 : typeof v === 'number' ? v : numericText(v);
      if (n === undefined) return v as string;
      const out = formatText(n, f === null ? '' : String(f));
      return out ?? err(ErrorType.VALUE, 'This number cannot be shown with that format (a negative date or time, or an unknown code)');
    });
  }

  value(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('VALUE'), (raw: unknown) => {
      const v = plain(raw);
      if (v instanceof CellError || typeof v === 'number') return v;
      if (typeof v !== 'string') return err(ErrorType.VALUE);
      const n = parseLooseNumber(v);
      if (n !== undefined) return n;
      const dt = this.dateTimeHelper.dateStringToDateNumber(v.trim()); // honours config.dateFormats/timeFormats
      return dt === undefined ? err(ErrorType.VALUE, 'Not a number') : (plain(dt) as number);
    });
  }

  index(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('INDEX'), (range: SimpleRangeValue, row?: number, col?: number) => {
      const h = range.height();
      const w = range.width();
      let r = row === undefined ? 0 : Math.trunc(row);
      let c: number;
      if (col !== undefined) c = Math.trunc(col);
      else if (h === 1 && w > 1) { c = r; r = 1; } // INDEX(row_vector, n): n is a column
      else if (w === 1) c = 1;                      // INDEX(column_vector, n)
      else c = 0;                                   // INDEX(2-D, n): the whole row (spills, as in Excel 365)
      if (r < 0 || c < 0) return err(ErrorType.VALUE, 'Index cannot be negative');
      if (r > h || c > w) return err(ErrorType.REF, 'Index is outside the range');
      const data = range.data;
      if (r === 0 && c === 0) return range;
      const at = startOf(range);
      let out: SimpleRangeValue;
      if (r === 0) {
        out = SimpleRangeValue.onlyValues(data.map((line) => [line[c - 1]]));
        if (at) indexOrigins.set(out, { sheet: at.sheet, row: at.row, col: at.col + c - 1 });
      } else if (c === 0) {
        out = SimpleRangeValue.onlyValues([data[r - 1]]);
        if (at) indexOrigins.set(out, { sheet: at.sheet, row: at.row + r - 1, col: at.col });
      } else {
        return data[r - 1][c - 1];
      }
      return out;
    });
  }
  /** Result size must be known before evaluation, so 0 (or an empty argument) is only honoured as a literal. */
  indexSize(ast: Ast, state: State): ArraySize {
    const size = this.arraySizeForAst(ast.args[0], state);
    const literal = (a: Ast): number | undefined => (a === undefined ? undefined : a.type === 'EMPTY' ? 0 : a.type === 'NUMBER' ? a.value : NaN);
    const r = literal(ast.args[1]);
    const c = literal(ast.args[2]);
    const oneD = size.height === 1 || size.width === 1;
    if (c === undefined) return r === 0 ? fullSize(size) : oneD ? ArraySize.scalar() : new ArraySize(size.width, 1);
    if (r === 0 && c === 0) return fullSize(size);
    if (r === 0) return new ArraySize(1, size.height);
    if (c === 0) return new ArraySize(size.width, 1);
    return ArraySize.scalar();
  }

  /** Excel 365's @ (implicit intersection): a range gives its cell in the formula's row or column (else #VALUE!),
   *  an array its top-left value, a single value itself. INDEX results count as the range they come from. */
  single(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('SINGLE'), (value: Scalar | SimpleRangeValue) => {
      const fill = (v: Scalar | undefined): Scalar => (v === EmptyValue || v === undefined ? 0 : v);
      if (!(value instanceof SimpleRangeValue)) return fill(value);
      const origin = startOf(value) ?? indexOrigins.get(value);
      if (!origin) return fill(value.data[0]?.[0]);
      const here: Origin = state.formulaAddress;
      const h = value.height();
      const w = value.width();
      const dr = h === 1 ? 0 : here.row - origin.row;
      const dc = w === 1 ? 0 : here.col - origin.col;
      if (dr < 0 || dr >= h || dc < 0 || dc >= w) return err(ErrorType.VALUE, 'No cell of that range is in the row or column of this formula');
      return fill(value.data[dr][dc]);
    });
  }

  /** MATCH with match_type 0 understands * ? ~ in a text lookup_value; every other case is HyperFormula's MATCH. */
  match(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('MATCH'), (key: unknown, range: SimpleRangeValue, type: number) => {
      const k = key === EmptyValue ? 0 : key;
      if (type === 0 && typeof k === 'string' && /[*?~]/.test(k)) {
        if (range.width() > 1 && range.height() > 1) return err(ErrorType.NA, 'MATCH needs a single row or column');
        const re = wildcardRegExp(k);
        const i = range.valuesFromTopLeftCorner().findIndex((v) => typeof v === 'string' && re.test(v));
        return i < 0 ? err(ErrorType.NA, 'Value not found.') : i + 1;
      }
      return this.lookupDelegate ? this.lookupDelegate.doMatch(k, range, type) : err(ErrorType.NA, 'MATCH is not available');
    });
  }

  lookup(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('LOOKUP'), (target: unknown, vector: SimpleRangeValue, result?: SimpleRangeValue) => {
      const t = plain(target);
      if (t instanceof CellError) return t;
      let keys = cellsOf(vector);
      let values = result ? cellsOf(result) : keys;
      if (!result && vector.width() > 1 && vector.height() > 1) { // array form: first row/col -> last row/col
        const data = vector.data.map((r) => r.map(plain));
        const wide = vector.width() > vector.height();
        keys = wide ? data[0] : data.map((r) => r[0]);
        values = wide ? data[data.length - 1] : data.map((r) => r[r.length - 1]);
      }
      const i = approxMatchIndex(keys.map((k) => (k instanceof CellError ? null : k)), t);
      if (i < 0 || i >= values.length) return err(ErrorType.NA, 'No match');
      return values[i] ?? 0;
    });
  }

  /** TREND(known_y, [known_x], [new_x], [const]): known_x defaults to 1..n; new_x to known_x; the result has new_x's shape. */
  trend(ast: Ast, state: State) {
    const noX = omitted(ast.args[1]);
    const noNew = omitted(ast.args[2]);
    return this.runFunction(ast.args, state, this.metadata('TREND'), (ky: SimpleRangeValue, kx: SimpleRangeValue | undefined, nx: unknown, withConst: boolean) => {
      const p = pairs(ky, noX ? undefined : kx, ErrorType.REF);
      if (p instanceof CellError) return p;
      const fit = linearFit(p.ys, p.xs, withConst);
      if (fit === 'DIV0') return err(ErrorType.DIV_BY_ZERO);
      const predict = (x: Cell | CellError) => (x instanceof CellError ? x : typeof x === 'number' ? fit.intercept + fit.slope * x : err(ErrorType.VALUE));
      const shaped = (grid: (Cell | CellError)[][]) => {
        const out = grid.map((line) => line.map(predict));
        return out.length === 1 && out[0].length === 1 ? out[0][0] : SimpleRangeValue.onlyValues(out);
      };
      if (!noNew) return nx instanceof SimpleRangeValue ? shaped(nx.data.map((line) => line.map(plain))) : predict(plain(nx));
      if (!noX && kx) return shaped(kx.data.map((line) => line.map(plain)));
      const width = ky.width();
      return shaped(ky.data.map((line, i) => line.map((_, j) => i * width + j + 1)));
    });
  }
  trendSize(ast: Ast, state: State): ArraySize {
    const source = !omitted(ast.args[2]) ? ast.args[2] : !omitted(ast.args[1]) ? ast.args[1] : ast.args[0];
    return source ? fullSize(this.arraySizeForAst(source, state)) : ArraySize.scalar();
  }

  forecast(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('FORECAST'), (x: number, ky: SimpleRangeValue, kx: SimpleRangeValue) => {
      const p = pairs(ky, kx, ErrorType.NA);
      if (p instanceof CellError) return p;
      const fit = linearFit(p.ys, p.xs);
      return fit === 'DIV0' ? err(ErrorType.DIV_BY_ZERO) : fit.intercept + fit.slope * x;
    });
  }
  intercept(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('INTERCEPT'), (ky: SimpleRangeValue, kx: SimpleRangeValue) => {
      const p = pairs(ky, kx, ErrorType.NA);
      if (p instanceof CellError) return p;
      const fit = linearFit(p.ys, p.xs);
      return fit === 'DIV0' ? err(ErrorType.DIV_BY_ZERO) : fit.intercept;
    });
  }

  frequency(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('FREQUENCY'), (data: SimpleRangeValue, bins: SimpleRangeValue) => {
      const d = numbersOf(data);
      const b = numbersOf(bins);
      if (d instanceof CellError) return d;
      if (b instanceof CellError) return b;
      const counts = frequency(d, b);
      return SimpleRangeValue.onlyValues(counts.map((c) => [c]));
    });
  }
  frequencySize(ast: Ast, state: State): ArraySize {
    const bins = ast.args[1] ? this.arraySizeForAst(ast.args[1], state) : ArraySize.scalar();
    return new ArraySize(1, bins.width * bins.height + 1);
  }

  percentrank(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('PERCENTRANK'), (data: SimpleRangeValue, x: number, sig: number) => {
      const d = numbersOf(data);
      if (d instanceof CellError) return d;
      const r = percentRankInc(d, x, sig);
      return typeof r === 'number' ? r : fromCode(r);
    });
  }
  rank(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('RANK'), (x: number, data: SimpleRangeValue, order: number) => {
      const d = numbersOf(data);
      if (d instanceof CellError) return d;
      const r = rankEq(x, d, order !== 0);
      return typeof r === 'number' ? r : fromCode(r);
    });
  }
  mode(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('MODE'), (...args: unknown[]) => {
      const all: number[] = [];
      for (const a of args) {
        const n = numbersOf(a);
        if (n instanceof CellError) return n;
        all.push(...n);
      }
      const r = modeSngl(all);
      return typeof r === 'number' ? r : fromCode(r);
    });
  }

  /** BINOM.INV / CRITBINOM(trials, probability_s, alpha): alpha may be 0 (gives 0) or 1 (gives trials). */
  binominv(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('BINOM.INV'), (trials: number, p: number, alpha: number) => {
      const r = binomInv(trials, p, alpha);
      return r === 'NUM' ? err(ErrorType.NUM, 'trials must be >= 0, probability_s and alpha between 0 and 1') : r;
    });
  }

  /** REPT: #VALUE! when the text would pass 32,767 characters, like Excel, checked before the text is built. */
  rept(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('REPT'), (text: string, count: number) => {
      if (count < 0) return err(ErrorType.VALUE, 'The number of times to repeat must be 0 or more.');
      const n = Math.trunc(count);
      if (text.length * n > MAX_TEXT) return err(ErrorType.VALUE, TEXT_TOO_LONG);
      return text.repeat(n);
    });
  }

  /** DATEDIF(start, end, unit) with HyperFormula's rules per unit, but the unit read in any case ("d", "ym") like Excel. */
  datedif(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('DATEDIF'), (start: number, end: number, unit: string) => {
      if (start > end) return err(ErrorType.NUM, 'The start date must not be after the end date');
      const u = unit.toUpperCase();
      if (u === 'D') return Math.floor(end) - Math.floor(start);
      const h = this.dateTimeHelper;
      const a = h.numberToSimpleDate(start);
      const b = h.numberToSimpleDate(end);
      const reached = b.month > a.month || (b.month === a.month && b.day >= a.day); // the anniversary in b's year
      switch (u) {
        case 'M': return (b.year - a.year) * 12 + (b.month - a.month) - (b.day < a.day ? 1 : 0);
        case 'YM': return (12 + (b.month - a.month) - (b.day < a.day ? 1 : 0)) % 12;
        case 'Y': return b.year - a.year - (reached ? 0 : 1);
        case 'MD': {
          if (b.day >= a.day) return b.day - a.day;
          const m = b.month === 1 ? 12 : b.month - 1;
          return h.daysInMonth(b.month === 1 ? b.year - 1 : b.year, m) + b.day - a.day;
        }
        case 'YD':
          return reached
            ? Math.floor(end) - h.dateToNumber({ year: b.year, month: a.month, day: a.day })
            : Math.floor(end) - Math.floor(start) - 365 * (b.year - a.year - 1) - h.leapYearsCount(b.year - 1) + h.leapYearsCount(a.year);
        default:
          return err(ErrorType.NUM, 'The unit must be "Y", "M", "D", "MD", "YM" or "YD"');
      }
    });
  }
}

const translationsFor = (plugin: { implementedFunctions: Record<string, unknown> }) =>
  ({ enGB: Object.fromEntries(Object.keys(plugin.implementedFunctions).map((k) => [k, k])) });
let registered = false;

/** Register once per page (HyperFormula plugins are global). Built-ins with the same name are replaced. */
export function registerExcelPack(): void {
  if (registered) return;
  HyperFormula.registerFunctionPlugin(ExcelCompatPlugin, translationsFor(ExcelCompatPlugin));
  HyperFormula.registerFunctionPlugin(ExcelCriteriaPlugin, translationsFor(ExcelCriteriaPlugin));
  patchTextArguments();
  patchReferenceArguments();
  patchTextLimits();
  registered = true;
}

/** Create an Excel-flavoured engine from row-major sheet data (formulas are strings starting with "="). */
export function buildExcelEngine(sheets: Record<string, (Cell)[][]>, extra: Partial<ConfigParams> = {}): HyperFormula {
  registerExcelPack();
  return HyperFormula.buildFromSheets(sheets, { ...EXCEL_CONFIG, ...extra }, EXCEL_NAMED_EXPRESSIONS);
}
