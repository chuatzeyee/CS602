// workbook.ts - thin, typed helpers over HyperFormula for the Excel lab:
// build from a JSON cell spec, set formulas, read values safely, fill down/right, recalculate.
import { DetailedCellError, HyperFormula } from 'hyperformula';
import type { CellValue, ConfigParams, SimpleCellAddress } from 'hyperformula';
import { EXCEL_CONFIG, EXCEL_NAMED_EXPRESSIONS, registerExcelPack } from './excelPack.ts';
import { parseLooseNumber } from './excelMath.ts';
import { toEngineFormula } from './formulaText.ts';
import { RandomSource, attachRandomSource, registerSeededRandom } from './seededRandom.ts';
import { TEXT_TOO_LONG } from './limits.ts';

export type CellInput = number | string | boolean | null;
/** JSON spec: sheets keyed by name; cells keyed by A1 address. Formulas are strings starting with "=". */
export interface WorkbookSpec {
  sheets: Record<string, Record<string, CellInput>>;
  names?: Record<string, string>; // e.g. { "Rate": "=Model!$B$2" }
  seed?: number;                  // reproducible RAND()/RANDBETWEEN()
  excelRedraw?: boolean;          // true = RAND redraws on every recalculation (Excel); default false
}
export interface Lab { hf: HyperFormula; random?: RandomSource }

const SCRATCH_SHEET = '__lab'; // hidden sheet used to trigger recalculation; hide it in the UI

export function colToIndex(letters: string): number {
  return letters.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}
export function indexToCol(index: number): string {
  let s = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
/** "B3" -> {row: 2, col: 1}; accepts $ signs. */
export function parseA1(a1: string): { row: number; col: number } {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(a1.trim());
  if (!m) throw new Error(`Bad cell address "${a1}"`);
  return { row: Number(m[2]) - 1, col: colToIndex(m[1]) };
}
/** "Model!B3" or "'My Sheet'!B3" (or "B3" with a default sheet) -> HyperFormula address. */
export function addr(hf: HyperFormula, ref: string, defaultSheet?: string): SimpleCellAddress {
  const bang = ref.lastIndexOf('!');
  const sheetName = bang >= 0 ? ref.slice(0, bang).replace(/^'(.*)'$/, '$1').replace(/''/g, "'") : defaultSheet;
  const sheet = sheetName === undefined ? 0 : hf.getSheetId(sheetName);
  if (sheet === undefined) throw new Error(`No sheet named "${sheetName}"`);
  return { sheet, ...parseA1(bang >= 0 ? ref.slice(bang + 1) : ref) };
}

/** What a user typed -> engine content ("$1,200" -> 1200, "=..." kept, "TRUE" -> true). */
export function normaliseInput(raw: string): CellInput {
  const t = raw.trim();
  if (t === '') return null;
  if (t.startsWith('=')) return toEngineFormula(t);
  if (/^(true|false)$/i.test(t)) return t.toUpperCase() === 'TRUE';
  const n = parseLooseNumber(t);
  return n === undefined ? raw : n; // dates/times like 2026-10-10 or 6:45 PM are parsed by the engine
}

export function buildWorkbook(spec: WorkbookSpec, extra: Partial<ConfigParams> = {}): Lab {
  registerExcelPack();
  const random = spec.seed === undefined ? undefined : new RandomSource(spec.seed, spec.excelRedraw ?? false);
  if (random) registerSeededRandom();
  const sheets: Record<string, CellInput[][]> = {};
  for (const [name, cells] of Object.entries(spec.sheets)) {
    const grid: CellInput[][] = [];
    for (const [a1, value] of Object.entries(cells)) {
      const { row, col } = parseA1(a1);
      while (grid.length <= row) grid.push([]);
      const line = grid[row];
      while (line.length < col) line.push(null);
      line[col] = typeof value === 'string' ? normaliseInput(value) : value; // "$1,200" -> 1200
    }
    sheets[name] = grid;
  }
  sheets[SCRATCH_SHEET] = [[0]];
  const names = [...EXCEL_NAMED_EXPRESSIONS, ...Object.entries(spec.names ?? {}).map(([name, expression]) => ({ name, expression }))];
  const hf = HyperFormula.buildFromSheets(sheets, { ...EXCEL_CONFIG, undoLimit: 20, ...extra, context: { random } }, names);
  if (random) attachRandomSource(hf, random);
  return { hf, random };
}

export type ReadResult =
  | { kind: 'number'; value: number }
  | { kind: 'text'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'empty' }
  | { kind: 'error'; code: string; message: string; hint: string };

const HINTS: Record<string, string> = {
  '#NAME?': 'Unknown name: check the spelling of the function or named range, and quote text with "".',
  '#DIV/0!': 'Division by zero, or an average of no numbers. Check the divisor: is it empty or 0? If it can be 0, guard with IF(divisor=0, ..., ...).',
  '#VALUE!': 'Wrong type of input, e.g. text where a number is expected.',
  '#REF!': 'The formula points at a cell or sheet that does not exist.',
  '#N/A': 'No match found (lookups) or a value is not available. Check exact/approximate match.',
  '#NUM!': 'Invalid number: e.g. SQRT of a negative, or an iterative function (IRR/RATE) did not converge.',
  '#CYCLE!': 'Circular reference: the formula refers back to itself, directly or through other cells. If that is intended (a circular model), turn on Iterative calculation; otherwise fix the reference.',
  '#SPILL!': 'The result is an array but the cells it needs are not empty.',
  '#ERROR!': 'The formula could not be parsed: check brackets, commas and quotes.',
};

// errors whose engine message says more than the code: the lab's size limits (limits.ts)
const MESSAGE_HINTS: Record<string, string> = {
  '#VALUE! Value too large.': 'The result is too big: an array can fill at most the lab\'s grid (1,000 rows by 26 columns).',
  [`#VALUE! ${TEXT_TOO_LONG}`]: TEXT_TOO_LONG,
};

/** Read a computed value; errors come back as data (never thrown) with a student-friendly hint. */
export function readCell(hf: HyperFormula, ref: string | SimpleCellAddress, defaultSheet?: string): ReadResult {
  const at = typeof ref === 'string' ? addr(hf, ref, defaultSheet) : ref;
  const v: CellValue = hf.getCellValue(at);
  if (v instanceof DetailedCellError) {
    const hint = MESSAGE_HINTS[`${v.value} ${v.message ?? ''}`] ?? HINTS[v.value] ?? '';
    return { kind: 'error', code: v.value, message: v.message ?? '', hint };
  }
  if (v === null || v === undefined) return { kind: 'empty' };
  if (typeof v === 'number') return { kind: 'number', value: v };
  if (typeof v === 'boolean') return { kind: 'boolean', value: v };
  return { kind: 'text', value: String(v) };
}
/** Convenience for checks: number or throw (use readCell in UI code). */
export function readNumber(hf: HyperFormula, ref: string, defaultSheet?: string): number {
  const r = readCell(hf, ref, defaultSheet);
  if (r.kind === 'number') return r.value;
  if (r.kind === 'empty') return 0;
  throw new Error(`${ref} is not a number: ${r.kind === 'error' ? r.code : r.kind}`);
}

/** Enter a formula or value as a user would type it. Syntax errors are reported, not thrown. */
export function setCell(hf: HyperFormula, ref: string, typed: string | number | boolean | null, defaultSheet?: string): { ok: true } | { ok: false; message: string } {
  const at = addr(hf, ref, defaultSheet);
  const content = typeof typed === 'string' ? normaliseInput(typed) : typed;
  if (typeof content === 'string' && content.startsWith('=') && !hf.validateFormula(content)) {
    return { ok: false, message: 'There is a problem with this formula (check brackets, commas and quotes).' };
  }
  if (!hf.isItPossibleToSetCellContents(at)) return { ok: false, message: 'This cell is part of a spilled array.' };
  hf.setCellContents(at, [[content]]);
  return { ok: true };
}

/** Excel fill handle: copy `source` (e.g. "C5" or "C5:D5") over `target` (e.g. "C5:C104"),
 *  adjusting relative references and keeping $-anchored parts fixed. One undo step. */
export function fill(hf: HyperFormula, source: string, target: string, defaultSheet?: string): void {
  const toRange = (r: string) => {
    const [a, b = a] = r.split(':');
    const start = addr(hf, a, defaultSheet);
    const end = addr(hf, b.includes('!') ? b : (a.includes('!') ? `${a.slice(0, a.lastIndexOf('!'))}!${b}` : b), defaultSheet);
    return { start, end };
  };
  const src = toRange(source);
  const dst = toRange(target);
  const data = hf.getFillRangeData(src, dst);
  hf.setCellContents(dst.start, data);
}

/** Recalculate volatile functions (F9). With a seeded source, redraw() first for new random numbers. */
export function recalc(lab: Lab, newDraw = true): void {
  if (newDraw) lab.random?.redraw();
  const sheet = lab.hf.getSheetId(SCRATCH_SHEET);
  if (sheet === undefined) { lab.hf.rebuildAndRecalculate(); return; }
  const at = { sheet, row: 0, col: 0 };
  const current = lab.hf.getCellValue(at);
  lab.hf.setCellContents(at, [[typeof current === 'number' ? current + 1 : 1]]); // any edit re-evaluates volatile cells
}
