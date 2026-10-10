// coercion.ts - three Excel coercion rules HyperFormula 3.5 gets wrong, patched in place:
// 1. "" (empty text, e.g. from =IF(...,"",...)) is not a number: =""-1, =""*1 and =A1-A2 with A1 ="" give #VALUE!.
//    Truly empty cells stay 0, and comparisons, & and functions that skip text in ranges (SUM, AVERAGE...) are untouched.
// 2. A number turned into text (&, CONCATENATE, LEN, LEFT...) keeps up to 15 significant digits: =1/3&"" is
//    "0.333333333333333", ="<="&8/1440 is "<=0.00555555555555556".
// 3. MEDIAN, NPV, AVEDEV, DEVSQ, GEOMEAN, HARMEAN, SKEW and SKEW.P count only the numbers in a referenced cell, as in a
//    range: =MEDIAN(A1,A2,A3) skips an A1 holding "" (or other text, TRUE, nothing), where HyperFormula converted it like
//    a typed argument (rule 1 then gave #VALUE!). Typed arguments still convert: =MEDIAN("",1) is #VALUE!.
// The engine patch is per HyperFormula instance (called from the Excel pack plugin's constructor); the text-argument
// and reference-argument patches are applied once to the plugin prototypes when the pack is registered.
import { CellError, EmptyValue, ErrorType, FunctionArgumentType, FunctionPlugin, HyperFormula, SimpleRangeValue } from 'hyperformula';
import { excelNumberText } from './excelMath.ts';
import { MAX_TEXT, TEXT_TOO_LONG } from './limits.ts';

type Coerce = (arg: unknown) => unknown;
interface EngineInternals {
  arithmeticHelper?: { coerceToMaybeNumber?: Coerce };
  concatOp?: (left: unknown, right: unknown) => unknown;
}

/** A plain number or HyperFormula's rich number (date, time, %, currency) as a JS number. */
function numberIn(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (v === null || typeof v !== 'object' || v instanceof CellError || v instanceof SimpleRangeValue) return undefined;
  const val = (v as { val?: unknown }).val;
  return typeof val === 'number' ? val : undefined;
}

const asText = (v: unknown): unknown => {
  const n = numberIn(v);
  return n === undefined ? v : excelNumberText(n);
};

const patchedEngines = new WeakSet<object>();

/** Apply the per-engine rules to a HyperFormula interpreter (idempotent; unknown internals are left alone). */
export function patchEngineCoercion(interpreter: unknown): void {
  if (interpreter === null || typeof interpreter !== 'object' || patchedEngines.has(interpreter)) return;
  patchedEngines.add(interpreter);
  const engine = interpreter as EngineInternals;
  const helper = engine.arithmeticHelper;
  const toNumber = helper?.coerceToMaybeNumber;
  if (helper && typeof toNumber === 'function') {
    const original = toNumber.bind(helper);
    helper.coerceToMaybeNumber = (arg) => (arg === '' ? undefined : original(arg));
  }
  const concat = engine.concatOp;
  if (typeof concat === 'function') engine.concatOp = (left, right) => capped(() => concat(asText(left), asText(right)));
}

/** Excel's 32,767-character cell limit on a text result (#VALUE! beyond it); a string JavaScript cannot build is the same */
function capped(compute: () => unknown): unknown {
  let out: unknown;
  try {
    out = compute();
  } catch (e) {
    if (e instanceof RangeError) return new CellError(ErrorType.VALUE, TEXT_TOO_LONG);
    throw e;
  }
  return typeof out === 'string' && out.length > MAX_TEXT ? new CellError(ErrorType.VALUE, TEXT_TOO_LONG) : out;
}

const LIMIT_PATCH = Symbol.for('cs602.excelTextLimit');

/** Every function result (CONCATENATE, TEXTJOIN, SUBSTITUTE, REPT...) obeys the cell's text limit (once per page). */
export function patchTextLimits(): void {
  const proto = FunctionPlugin.prototype as unknown as Record<PropertyKey, unknown> & {
    calculateSingleCellOfResultArray: (this: unknown, ...args: unknown[]) => unknown;
  };
  if (proto[LIMIT_PATCH] || typeof proto.calculateSingleCellOfResultArray !== 'function') return;
  const original = proto.calculateSingleCellOfResultArray;
  proto.calculateSingleCellOfResultArray = function calculateSingleCellOfResultArray(...args) {
    return capped(() => original.apply(this, args));
  };
  proto[LIMIT_PATCH] = true;
}

const TEXT_PATCH = Symbol.for('cs602.excelTextArguments');

/** Number arguments of text functions become text with 15 significant digits (once per page). */
export function patchTextArguments(): void {
  const proto = FunctionPlugin.prototype as unknown as Record<PropertyKey, unknown> & {
    coerceToType: (this: unknown, arg: unknown, type: { argumentType?: string }, state: unknown) => unknown;
  };
  if (proto[TEXT_PATCH]) return;
  const original = proto.coerceToType;
  proto.coerceToType = function coerceToType(arg, type, state) {
    if (type?.argumentType === FunctionArgumentType.STRING) {
      const n = numberIn(arg);
      if (n !== undefined) return excelNumberText(n);
    }
    return original.call(this, arg, type, state);
  };
  proto[TEXT_PATCH] = true;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- HF does not export its Ast/State types */
type Ast = any;
type Method = ((this: { evaluateAst(ast: Ast, state: unknown): unknown }, ast: Ast, state: unknown) => unknown) & { [REFERENCE_PATCH]?: true };
const REFERENCE_PATCH = Symbol.for('cs602.excelReferenceArguments');
// the functions, and the first argument that is a value list (NPV's rate is a plain number)
const VALUE_LISTS: Record<string, number> = { MEDIAN: 0, AVEDEV: 0, DEVSQ: 0, GEOMEAN: 0, HARMEAN: 0, SKEW: 0, 'SKEW.P': 0, NPV: 1 };
// stands in for a skipped reference: a 1x2 array of "" (a 1x1 result would be read as a single value again)
const NO_NUMBERS: Ast = { type: 'ARRAY', args: [[{ type: 'STRING', value: '' }, { type: 'STRING', value: '' }]] };
const skipped = (v: unknown): boolean => typeof v === 'string' || typeof v === 'boolean' || v === EmptyValue;

/** Single-cell references in the value lists of VALUE_LISTS hold numbers only, like ranges (once per page). */
export function patchReferenceArguments(): void {
  for (const [name, from] of Object.entries(VALUE_LISTS)) {
    const plugin = HyperFormula.getFunctionPlugin(name) as unknown as { prototype: Record<string, Method>; implementedFunctions?: Record<string, { method?: string }> } | undefined;
    const method = plugin?.implementedFunctions?.[name]?.method;
    const original = method ? plugin?.prototype[method] : undefined;
    if (!plugin || !method || typeof original !== 'function' || original[REFERENCE_PATCH]) continue;
    const patched: Method = function patchedValueList(ast, state) {
      const args = (ast.args as Ast[]).map((a, i) => (i >= from && a?.type === 'CELL_REFERENCE' && skipped(this.evaluateAst(a, state)) ? NO_NUMBERS : a));
      return original.call(this, { ...ast, args }, state);
    };
    patched[REFERENCE_PATCH] = true;
    plugin.prototype[method] = patched;
  }
}
