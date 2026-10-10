// dataTable.ts - Excel What-If data tables on a HyperFormula sheet: one-variable column-oriented (values down the
// first column, formulas across the first row, column input), row-oriented (values across, formulas down, row input)
// and two-variable (formula top-left, both inputs). Every substitution redraws RAND first, so a table whose input
// cell is a blank cell runs independent Monte Carlo replications, like Excel.
import { DetailedCellError } from 'hyperformula';
import type { HyperFormula, RawCellContent, SimpleCellAddress } from 'hyperformula';
import type { RandomSource } from './seededRandom.ts';
import type { DataTableDef } from '../types';
import { inBox, parseRange, parseRef, toRange, toRef } from '../refs';
import type { RangeBox } from '../refs';

export type TableKind = 'column' | 'row' | 'two';
interface Pos { row: number; col: number }
export interface TablePlan {
  def: DataTableDef;   // normalised refs
  box: RangeBox;       // the whole selection
  body: RangeBox;      // computed cells
  kind: TableKind;
  rowIn?: Pos;
  colIn?: Pos;
}

/** Validate a definition against the sheet size; returns a learner-facing message when it is unusable. */
export function planDataTable(def: DataTableDef, rows: number, cols: number): TablePlan | string {
  if (!def || typeof def.range !== 'string' || def.range.trim() === '') return 'Select the whole table first: the input values plus the formula row or column.';
  let box: RangeBox;
  try {
    box = parseRange(def.range);
  } catch {
    return `"${def.range}" is not a valid range.`;
  }
  if (box.r2 >= rows || box.c2 >= cols) return `The table ${toRange(box)} goes past the edge of the sheet.`;
  if (box.r2 === box.r1 || box.c2 === box.c1) return 'A data table needs at least two rows and two columns: the input values plus the formula row or column.';
  const input = (text: unknown, label: string): Pos | string | undefined => {
    if (text === undefined || text === null || text === '') return undefined;
    if (typeof text !== 'string') return `The ${label} input cell is not a cell reference.`;
    if (text.trim() === '') return undefined;
    let p: Pos;
    try {
      p = parseRef(text);
    } catch {
      return `Input cell reference is not valid: "${text}".`;
    }
    if (p.row >= rows || p.col >= cols) return `The ${label} input cell ${toRef(p.row, p.col)} is outside the sheet.`;
    if (inBox(box, p.row, p.col)) return `The ${label} input cell ${toRef(p.row, p.col)} must be outside the table ${toRange(box)}.`;
    return { row: p.row, col: p.col };
  };
  const rowIn = input(def.rowInput, 'row');
  if (typeof rowIn === 'string') return rowIn;
  const colIn = input(def.colInput, 'column');
  if (typeof colIn === 'string') return colIn;
  if (!rowIn && !colIn) return 'Input cell reference is not valid: enter a row input cell, a column input cell, or both.';
  if (rowIn && colIn && rowIn.row === colIn.row && rowIn.col === colIn.col) return 'The row and column input cells must be different cells.';
  const norm: DataTableDef = {
    range: toRange(box),
    ...(rowIn ? { rowInput: toRef(rowIn.row, rowIn.col) } : {}),
    ...(colIn ? { colInput: toRef(colIn.row, colIn.col) } : {}),
  };
  const kind: TableKind = rowIn && colIn ? 'two' : colIn ? 'column' : 'row';
  return { def: norm, box, body: { r1: box.r1 + 1, c1: box.c1 + 1, r2: box.r2, c2: box.c2 }, kind, rowIn, colIn };
}

/** Engine content that reproduces a computed value (text quoted, errors as their literal code). */
function contentOf(v: unknown): RawCellContent {
  if (v instanceof DetailedCellError) return v.value;
  if (typeof v === 'string') return `'${v}`;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  return null;
}

/** Run the table and return the body values; the input cells are restored afterwards. Does not write the body. */
export function computeDataTable(hf: HyperFormula, sheet: number, plan: TablePlan, random?: RandomSource): RawCellContent[][] {
  const at = (p: Pos): SimpleCellAddress => ({ sheet, row: p.row, col: p.col });
  const { box, body } = plan;
  const value = (row: number, col: number): RawCellContent => contentOf(hf.getCellValue(at({ row, col })));
  const output = (row: number, col: number): RawCellContent => value(row, col) ?? 0;
  const inputs = [plan.rowIn, plan.colIn].filter((p): p is Pos => p !== undefined);
  const saved = inputs.map((p) => hf.getCellSerialized(at(p)) as RawCellContent);
  const substitute = (pairs: [Pos | undefined, RawCellContent][]): void => {
    random?.redraw();
    hf.batch(() => pairs.forEach(([p, v]) => { if (p) hf.setCellContents(at(p), [[v]]); }));
  };
  const height = body.r2 - body.r1 + 1;
  const width = body.c2 - body.c1 + 1;
  const downValues = Array.from({ length: height }, (_, i) => value(body.r1 + i, box.c1)); // read before any substitution
  const acrossValues = Array.from({ length: width }, (_, j) => value(box.r1, body.c1 + j));
  const out: RawCellContent[][] = Array.from({ length: height }, () => new Array<RawCellContent>(width).fill(null));
  try {
    if (plan.kind === 'column') {
      for (let i = 0; i < height; i++) {
        substitute([[plan.colIn, downValues[i]]]);
        for (let j = 0; j < width; j++) out[i][j] = output(box.r1, body.c1 + j);
      }
    } else if (plan.kind === 'row') {
      for (let j = 0; j < width; j++) {
        substitute([[plan.rowIn, acrossValues[j]]]);
        for (let i = 0; i < height; i++) out[i][j] = output(body.r1 + i, box.c1);
      }
    } else {
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          substitute([[plan.rowIn, acrossValues[j]], [plan.colIn, downValues[i]]]);
          out[i][j] = output(box.r1, box.c1);
        }
      }
    }
  } finally {
    hf.batch(() => inputs.forEach((p, i) => hf.setCellContents(at(p), [[saved[i]]])));
  }
  return out;
}
