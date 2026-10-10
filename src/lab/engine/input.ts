// input.ts - what a learner types -> engine content, plus the number format Excel would auto-apply
// ('12%' -> 0.12 '0%', '$1,200' -> 1200 '$#,##0', '2026-10-10' -> 46305 'yyyy-mm-dd', '6:45 PM' -> 0.78125 'h:mm AM/PM').
// Formulas are handed to the engine in its own syntax (formulaText.ts: @, 1E-12, resized SUMIF ranges).
import { parseLooseNumber } from './excelMath.ts';
import { parseDateText, parseTimeText } from './dateText.ts';
import { toEngineFormula } from './formulaText.ts';

export { dateSerial } from './dateText.ts';

export type ParsedInput =
  | { kind: 'empty' }
  | { kind: 'formula'; formula: string }
  | { kind: 'value'; value: string | number | boolean; fmt?: string };

function numberFormatFor(t: string): string | undefined {
  const decimals = (/\.(\d+)/.exec(t)?.[1].length) ?? 0;
  if (/%\)?$/.test(t)) return decimals ? `0.${'0'.repeat(decimals)}%` : '0%';
  const symbol = /^\(?[-+]?\s*(S\$|US\$|\$|€|£)/.exec(t)?.[1];
  if (symbol) {
    const sym = symbol === '$' ? '$' : `"${symbol}"`;
    return decimals ? `${sym}#,##0.00` : `${sym}#,##0`;
  }
  if (/\d,\d{3}/.test(t)) return decimals ? `#,##0.${'0'.repeat(decimals)}` : '#,##0';
  if (/\d[eE][-+]?\d/.test(t)) return '0.00E+00';
  return undefined;
}

/** Parse a cell entry like Excel. Text keeps its spaces; a leading apostrophe forces text. */
export function parseInput(raw: string): ParsedInput {
  const t = raw.trim();
  if (t === '') return { kind: 'empty' };
  if (raw.startsWith("'")) return { kind: 'value', value: raw.slice(1) };
  if (t.startsWith('=')) return { kind: 'formula', formula: toEngineFormula(t) };
  if (/^(true|false)$/i.test(t)) return { kind: 'value', value: t.toUpperCase() === 'TRUE' };
  const n = parseLooseNumber(t);
  if (n !== undefined && Number.isFinite(n)) {
    const fmt = numberFormatFor(t);
    return fmt ? { kind: 'value', value: n, fmt } : { kind: 'value', value: n };
  }
  const when = parseDateText(t) ?? parseTimeText(t);
  if (when) return { kind: 'value', value: when.value, fmt: when.fmt };
  return { kind: 'value', value: raw };
}

/** The entry that parses back to exactly `value` (text that would be read as something else gets an apostrophe). */
export function canonicalRaw(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '#NUM!';
  const p = parseInput(value);
  return p.kind === 'value' && p.value === value ? value : `'${value}`;
}
