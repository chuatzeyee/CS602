// conditional.ts - COUNTIF, COUNTIFS, SUMIF, SUMIFS, AVERAGEIF, AVERAGEIFS, MINIFS, MAXIFS, COUNTBLANK with Excel's criteria
// (excelMath.makeCriterion): "" also matches empty text from formulas, an empty criteria cell means 0, ">x" compares
// text instead of failing, dates/times written in words are serials, numbers stored as text match numbers.
// SUMIF/AVERAGEIF use a sum range of another shape the Excel way: its top-left cell plus the shape of range
// (formulaText.ts passes the resized range as a hidden 4th argument so the engine tracks those cells).
import { CellError, EmptyValue, ErrorType, FunctionArgumentType, FunctionPlugin, SimpleRangeValue } from 'hyperformula';
import { makeCriterion } from './excelMath.ts';
import type { Cell, CriteriaCell } from './excelMath.ts';

/* eslint-disable @typescript-eslint/no-explicit-any -- HF does not export its Ast/State types */
type Ast = any;
type State = any;

const { RANGE, NOERROR, SCALAR } = FunctionArgumentType;
const ERROR_TEXT: Record<string, string> = {
  NA: '#N/A', DIV_BY_ZERO: '#DIV/0!', VALUE: '#VALUE!', REF: '#REF!', NAME: '#NAME?', NUM: '#NUM!',
  CYCLE: '#CYCLE!', SPILL: '#SPILL!', ERROR: '#ERROR!', LIC: '#LIC!',
};
const sizeError = () => new CellError(ErrorType.VALUE, 'All ranges must be the same size');

function richValue(v: unknown): unknown {
  return v !== null && typeof v === 'object' && typeof (v as { val?: unknown }).val === 'number' ? (v as { val: number }).val : v;
}

/** A range cell as the criteria matcher sees it: null for empty, { error } for errors. */
function criteriaCell(v: unknown): CriteriaCell {
  if (v instanceof CellError) return { error: ERROR_TEXT[v.type] ?? '#VALUE!' };
  if (v === EmptyValue || v === undefined || v === null) return null;
  return richValue(v) as Cell;
}

/** The criteria argument: an empty cell becomes null (= 0 for the matcher). */
function criterionValue(v: unknown): Cell {
  return v === EmptyValue || v === undefined ? null : (richValue(v) as Cell);
}

const sameShape = (a: SimpleRangeValue, b: SimpleRangeValue): boolean => a.width() === b.width() && a.height() === b.height();
const startOf = (r: SimpleRangeValue): { sheet: number; row: number; col: number } | undefined =>
  (r.range as { start?: { sheet: number; row: number; col: number } } | undefined)?.start;

/** The values SUMIF/AVERAGEIF add up, lined up with `range` (Excel resizes a sum range of another shape). */
function lineUp(range: SimpleRangeValue, values?: SimpleRangeValue, resized?: SimpleRangeValue): unknown[] | CellError {
  if (!values) {
    return resized ? new CellError(ErrorType.NA, 'Wrong number of arguments.') : range.valuesFromTopLeftCorner();
  }
  const h = range.height();
  const w = range.width();
  const covers = values.height() >= h && values.width() >= w;
  if (resized) {
    const a = startOf(values);
    const b = startOf(resized);
    const fits = !covers && sameShape(resized, range) && (!a || !b || (a.sheet === b.sheet && a.row === b.row && a.col === b.col));
    return fits ? resized.valuesFromTopLeftCorner() : new CellError(ErrorType.NA, 'Wrong number of arguments.');
  }
  if (sameShape(values, range)) return values.valuesFromTopLeftCorner();
  if (covers) return values.data.slice(0, h).flatMap((row) => row.slice(0, w));
  return new CellError(ErrorType.VALUE, 'The sum range must start a block the size of the criteria range');
}

/** Rows (flat indices) where every (range, criterion) pair matches; all ranges must have the size of `shape`. */
function matches(shape: SimpleRangeValue, pairs: unknown[]): boolean[] | CellError {
  const n = shape.width() * shape.height();
  const ok = new Array<boolean>(n).fill(true);
  for (let p = 0; p < pairs.length; p += 2) {
    const range = pairs[p] as SimpleRangeValue;
    if (!sameShape(range, shape)) return sizeError();
    const test = makeCriterion(criterionValue(pairs[p + 1]));
    const cells = range.valuesFromTopLeftCorner();
    for (let i = 0; i < n; i++) if (ok[i] && !test(criteriaCell(cells[i]))) ok[i] = false;
  }
  return ok;
}

export class ExcelCriteriaPlugin extends FunctionPlugin {
  static implementedFunctions = {
    COUNTIF: { method: 'countif', parameters: [{ argumentType: RANGE }, { argumentType: NOERROR }] },
    COUNTIFS: { method: 'countifs', parameters: [{ argumentType: RANGE }, { argumentType: NOERROR }], repeatLastArgs: 2 },
    SUMIF: {
      method: 'sumif',
      parameters: [{ argumentType: RANGE }, { argumentType: NOERROR }, { argumentType: RANGE, optionalArg: true }, { argumentType: RANGE, optionalArg: true }],
    },
    SUMIFS: { method: 'sumifs', parameters: [{ argumentType: RANGE }, { argumentType: RANGE }, { argumentType: NOERROR }], repeatLastArgs: 2 },
    AVERAGEIF: {
      method: 'averageif',
      parameters: [{ argumentType: RANGE }, { argumentType: NOERROR }, { argumentType: RANGE, optionalArg: true }, { argumentType: RANGE, optionalArg: true }],
    },
    AVERAGEIFS: { method: 'averageifs', parameters: [{ argumentType: RANGE }, { argumentType: RANGE }, { argumentType: NOERROR }], repeatLastArgs: 2 },
    MINIFS: { method: 'minifs', parameters: [{ argumentType: RANGE }, { argumentType: RANGE }, { argumentType: NOERROR }], repeatLastArgs: 2 },
    MAXIFS: { method: 'maxifs', parameters: [{ argumentType: RANGE }, { argumentType: RANGE }, { argumentType: NOERROR }], repeatLastArgs: 2 },
    COUNTBLANK: { method: 'countblank', parameters: [{ argumentType: SCALAR }], repeatLastArgs: 1, expandRanges: true },
  };

  private total(values: unknown[], picked: (i: number) => boolean): { sum: number; count: number } | CellError {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < values.length; i++) {
      if (!picked(i)) continue;
      const v = values[i];
      if (v instanceof CellError) return v;
      const n = richValue(v);
      if (typeof n !== 'number') continue;
      sum = this.arithmeticHelper.addWithEpsilonRaw(sum, n);
      count += 1;
    }
    return { sum, count };
  }

  countif(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('COUNTIF'), (range: SimpleRangeValue, criterion: unknown) => {
      const test = makeCriterion(criterionValue(criterion));
      let count = 0;
      for (const v of range.valuesFromTopLeftCorner()) if (test(criteriaCell(v))) count += 1;
      return count;
    });
  }

  countifs(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('COUNTIFS'), (...args: unknown[]) => {
      const ok = matches(args[0] as SimpleRangeValue, args);
      return ok instanceof CellError ? ok : ok.filter(Boolean).length;
    });
  }

  sumif(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('SUMIF'),
      (range: SimpleRangeValue, criterion: unknown, sumRange?: SimpleRangeValue, resized?: SimpleRangeValue) => {
        const values = lineUp(range, sumRange, resized);
        if (values instanceof CellError) return values;
        const ok = matches(range, [range, criterion]);
        if (ok instanceof CellError) return ok;
        const t = this.total(values, (i) => ok[i]);
        return t instanceof CellError ? t : t.sum;
      });
  }

  sumifs(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('SUMIFS'), (sumRange: SimpleRangeValue, ...pairs: unknown[]) => {
      const ok = matches(sumRange, pairs);
      if (ok instanceof CellError) return ok;
      const t = this.total(sumRange.valuesFromTopLeftCorner(), (i) => ok[i]);
      return t instanceof CellError ? t : t.sum;
    });
  }

  averageif(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('AVERAGEIF'),
      (range: SimpleRangeValue, criterion: unknown, avgRange?: SimpleRangeValue, resized?: SimpleRangeValue) => {
        const values = lineUp(range, avgRange, resized);
        if (values instanceof CellError) return values;
        const ok = matches(range, [range, criterion]);
        if (ok instanceof CellError) return ok;
        const t = this.total(values, (i) => ok[i]);
        if (t instanceof CellError) return t;
        return t.count === 0 ? new CellError(ErrorType.DIV_BY_ZERO) : t.sum / t.count;
      });
  }

  averageifs(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('AVERAGEIFS'), (avgRange: SimpleRangeValue, ...pairs: unknown[]) => {
      const ok = matches(avgRange, pairs);
      if (ok instanceof CellError) return ok;
      const t = this.total(avgRange.valuesFromTopLeftCorner(), (i) => ok[i]);
      if (t instanceof CellError) return t;
      return t.count === 0 ? new CellError(ErrorType.DIV_BY_ZERO) : t.sum / t.count;
    });
  }

  /** MINIFS/MAXIFS: the smallest/largest number among the matching cells, 0 when none matches. */
  private extreme(name: 'MINIFS' | 'MAXIFS', ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata(name), (range: SimpleRangeValue, ...pairs: unknown[]) => {
      const ok = matches(range, pairs);
      if (ok instanceof CellError) return ok;
      const values = range.valuesFromTopLeftCorner();
      let best: number | undefined;
      for (let i = 0; i < values.length; i++) {
        if (!ok[i]) continue;
        const v = values[i];
        if (v instanceof CellError) return v;
        const n = richValue(v);
        if (typeof n === 'number' && (best === undefined || (name === 'MINIFS' ? n < best : n > best))) best = n;
      }
      return best ?? 0;
    });
  }
  minifs(ast: Ast, state: State) { return this.extreme('MINIFS', ast, state); }
  maxifs(ast: Ast, state: State) { return this.extreme('MAXIFS', ast, state); }

  /** Empty cells and cells holding empty text ("" from a formula); zeros are not blank. */
  countblank(ast: Ast, state: State) {
    return this.runFunction(ast.args, state, this.metadata('COUNTBLANK'), (...values: unknown[]) =>
      values.filter((v) => v === EmptyValue || v === '').length);
  }
}
