// limits.ts - Excel's size limits, enforced so one entry cannot freeze the tab (and freeze it again on every reload,
// since entries are saved): a cell holds at most 32,767 characters, a formula at most 8,192, and formulas read only
// the lab's grid (1,000 rows x columns A-Z; the engine's own limit, so a spill or a range cannot grow past it).

export const MAX_TEXT = 32767;
export const MAX_FORMULA = 8192;
export const GRID_ROWS = 1000;
export const GRID_COLS = 26;
export const MAX_NESTING = 64;   // levels of brackets (Excel's limit for nested functions); deeper overflows the parser

export const TEXT_TOO_LONG = 'The result would be longer than 32,767 characters, the most a cell can hold.';

const thousands = (n: number): string => n.toLocaleString('en-US');

/** A learner-facing problem with the length of an entry ('=...' formula or typed text), if any. */
export function lengthProblem(raw: string): string | undefined {
  if (raw.trimStart().startsWith('=')) {
    return raw.length > MAX_FORMULA ? `This formula is too long: a formula can have at most ${thousands(MAX_FORMULA)} characters.` : undefined;
  }
  return raw.length > MAX_TEXT ? `This entry is too long: a cell can hold at most ${thousands(MAX_TEXT)} characters.` : undefined;
}

/** The deepest bracket nesting of a formula, outside text. */
export function nestingDepth(formula: string): number {
  let depth = 0;
  let max = 0;
  let inText = false;
  for (const ch of formula) {
    if (ch === '"') inText = !inText;
    else if (!inText && ch === '(') max = Math.max(max, ++depth);
    else if (!inText && ch === ')') depth -= 1;
  }
  return max;
}
