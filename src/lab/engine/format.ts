// format.ts - display text for a computed value: Excel number format codes via SheetJS SSF, or Excel-like General.
// Cell display (formatNumber) and the TEXT() function (formatText) share the rules SSF lacks:
// - values are rounded the Excel way first (half away from zero on 15 significant digits): 2.175 "0.00" -> 2.18;
// - times are rounded to the smallest unit shown and the carry moves up: 59.6 s "h:mm:ss" -> 0:01:00;
// - a negative (or past year 9999) date/time cannot be shown: the cell shows ########, TEXT gives #VALUE!;
// - from 1e15 on (after % and trailing-comma scaling) the digits are written here: 15 significant digits, then zeros.
//   SSF prints binary noise there and garbles numbers whose JS text is exponential (1e21 up): "$2.3," for 2.3E+113.
import SSF from 'ssf';
import { excelNumberText, excelRound } from './excelMath.ts';

/** What a cell shows when its date/time value cannot be displayed. */
export const DATE_OVERFLOW = '########';
const LAST_DATE = 2958466; // 1 Jan 10000
const NO_DATE = Symbol('no date');

/** Excel "General" in a standard-width column: integers plain, up to 10 significant digits, scientific when huge or tiny. */
export function formatGeneral(n: number): string {
  if (!Number.isFinite(n)) return '#NUM!';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e11 || abs < 1e-5) return scientific(n);
  const s = String(Number(n.toPrecision(10)));
  return s.includes('e') ? scientific(n) : s;
}

function scientific(n: number): string {
  const [mantissa, exp] = n.toExponential(5).split('e');
  const m = mantissa.includes('.') ? mantissa.replace(/\.?0+$/, '') : mantissa;
  const e = Number(exp);
  return `${m}E${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;
}

/** The format's sections (positive;negative;zero;text), split outside quotes, escapes and brackets. */
function sections(fmt: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < fmt.length; i++) {
    const ch = fmt[i];
    if (ch === '"') {
      const end = fmt.indexOf('"', i + 1);
      const stop = end < 0 ? fmt.length : end;
      cur += fmt.slice(i, stop + 1);
      i = stop;
    } else if (ch === '\\' || ch === '_' || ch === '*') {
      cur += fmt.slice(i, i + 2);
      i += 1;
    } else if (ch === '[') {
      const end = fmt.indexOf(']', i + 1);
      const stop = end < 0 ? fmt.length : end;
      cur += fmt.slice(i, stop + 1);
      i = stop;
    } else if (ch === ';') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** The section used for a number (undefined when the format has [conditions]: then SSF decides alone); minus: Excel
 *  writes the sign itself (a negative number shown by the first section). */
function sectionFor(fmt: string, n: number): { text: string; minus: boolean } | undefined {
  const all = sections(fmt);
  if (all.some((s) => /\[(?:<|>|=)/.test(s))) return undefined;
  const nums = all.length < 4 && all.length > 1 && /@/.test(bare(all[all.length - 1])) ? all.slice(0, -1) : all.slice(0, 3);
  if (n < 0 && nums.length > 1) return { text: nums[1], minus: false };
  if (n === 0 && nums.length > 2) return { text: nums[2], minus: false };
  return { text: nums[0], minus: n < 0 };
}

/** A section without literal text: quoted strings, escaped characters, _x spacers, *x fills and [colour]/[$...] tags. */
function bare(section: string): string {
  return section
    .replace(/"[^"]*"?/g, '')
    .replace(/[\\_*]./g, '')
    .replace(/\[(?!(?:h+|m+|s+)\])[^\]]*\]/gi, '');
}

function isTimeSection(clean: string): boolean {
  return /[hs]/i.test(clean) || /\[m+\]/i.test(clean) || /am\/pm|a\/p/i.test(clean);
}

/** Round a date-time serial to the smallest time unit the section shows (seconds or 0.1/0.01/0.001 s). */
function roundTime(n: number, clean: string): number {
  const digits = Math.min(3, /s+\.(0+)/i.exec(clean)?.[1].length ?? 0);
  const units = 86400 * 10 ** digits;
  return excelRound(n * units, 0, 'nearest') / units;
}

/** A plain number section's decimals and the scale its % signs and trailing commas apply; undefined for General,
 *  scientific, fraction and text sections and sections without digit placeholders. */
function numberLayout(clean: string): { decimals: number; scale: number } | undefined {
  if (/general/i.test(clean) || /[eE][+-]/.test(clean) || /[0#?]\s*\/\s*[0-9#?]/.test(clean) || /@/.test(clean)) return undefined;
  const last = Math.max(clean.lastIndexOf('0'), clean.lastIndexOf('#'), clean.lastIndexOf('?'));
  if (last < 0) return undefined;
  const decimals = /\.([0#?]+)/.exec(clean)?.[1].length ?? 0;
  const commas = /^,*/.exec(clean.slice(last + 1))?.[0].length ?? 0;
  return { decimals, scale: 100 ** (clean.match(/%/g)?.length ?? 0) / 1000 ** commas };
}

/** Round a number to the decimals a number section shows (after % and trailing-comma scaling), Excel style. */
function roundNumber(n: number, clean: string): number {
  const layout = numberLayout(clean);
  if (!layout) return n;
  const back = excelRound(n * layout.scale, layout.decimals, 'nearest') / layout.scale;
  return Number.isFinite(back) && (back !== 0 || n === 0) ? back : n;
}

const BIG = 1e15; // from here 15 significant digits end at or before the units digit: every decimal shows 0

/** The whole digits of v (>= 1e15) as Excel shows them: 15 significant digits, then zeros. */
function bigDigits(v: number): string {
  const [mantissa, exp] = v.toExponential(14).split('e');
  return mantissa.replace('.', '').padEnd(Number(exp) + 1, '0');
}

type Part = { lit: string } | { mark: string };

/** A number section as literal text and number marks (0 # ? . ,): quoted text, \x, _x as a space, [$sym-...] as
 *  sym; *x fills and [colours] are dropped. */
function sectionParts(section: string): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i < section.length; i++) {
    const ch = section[i];
    if (ch === '"' || ch === '[') {
      const end = section.indexOf(ch === '"' ? '"' : ']', i + 1);
      const stop = end < 0 ? section.length : end;
      const inner = section.slice(i + 1, stop);
      if (ch === '"') parts.push({ lit: inner });
      else if (inner.startsWith('$')) parts.push({ lit: /^\$([^-]*)/.exec(inner)?.[1] ?? '' });
      i = stop;
    } else if (ch === '\\' || ch === '_' || ch === '*') {
      if (ch !== '*') parts.push({ lit: ch === '_' ? ' ' : section[i + 1] ?? '' });
      i += 1;
    } else {
      parts.push('0#?.,'.includes(ch) ? { mark: ch } : { lit: ch });
    }
  }
  return parts;
}

/** A number section for a scaled value of at least 1e15, written without SSF: its literal text in place, the digit
 *  run as bigDigits with the section's thousands separators and decimal places (all 0 there; # shows nothing, ? a
 *  space). Undefined for a layout this does not cover (text between the digit marks). */
function formatBig(section: string, scaled: number, minus: boolean): string | undefined {
  const parts = sectionParts(section);
  const isDigit = (p: Part) => 'mark' in p && '0#?'.includes(p.mark);
  const first = parts.findIndex(isDigit);
  let last = parts.length - 1;
  while (last >= 0 && !isDigit(parts[last])) last--;
  if (first < 0 || parts.slice(first, last + 1).some((p) => 'lit' in p)) return undefined;
  const marks = parts.slice(first, last + 1).map((p) => ('mark' in p ? p.mark : '')).join('');
  const [whole, decimals] = marks.split('.');
  const tail = parts.slice(last + 1);                // commas there only scale the value
  const pointOnly = decimals === undefined && tail.some((p) => 'mark' in p && p.mark === '.');
  const digits = bigDigits(scaled);
  const holders = whole.replace(/,/g, '');           // 0 and ? keep a minimum number of digits
  const padded = holders.slice(0, Math.max(0, holders.length - digits.length)).replace(/#/g, '').replace(/\?/g, ' ') + digits;
  const grouped = /[0#?],+[0#?]/.test(whole) ? padded.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : padded;
  const fraction = decimals !== undefined ? `.${decimals.replace(/[,#]/g, '').replace(/\?/g, ' ')}` : pointOnly ? '.' : '';
  const text = (ps: Part[]) => ps.map((p) => ('lit' in p ? p.lit : '')).join('');
  return `${minus ? '-' : ''}${text(parts.slice(0, first))}${grouped}${fraction}${text(tail)}`;
}

/** SSF with Excel's rounding; NO_DATE when a date/time format gets a value it cannot show; undefined if SSF fails. */
function formatWith(n: number, fmt: string): string | typeof NO_DATE | undefined {
  let value = n;
  const picked = sectionFor(fmt, n);
  if (picked !== undefined) {
    const section = picked.text;
    const clean = bare(section);
    if (SSF.is_date(section)) {
      if (n < 0 || n >= LAST_DATE) return NO_DATE;
      if (isTimeSection(clean)) value = roundTime(n, clean);
    } else {
      const layout = numberLayout(clean);
      const scaled = layout ? Math.abs(n) * layout.scale : 0;
      const big = layout && Number.isFinite(scaled) && scaled >= BIG ? formatBig(section, scaled, picked.minus) : undefined;
      if (big !== undefined) return big;
      value = roundNumber(n, clean);
    }
  }
  try {
    return SSF.format(fmt, value);
  } catch {
    return undefined;
  }
}

/** Format a number with an Excel format code for a cell; an unusable code falls back to General. */
export function formatNumber(n: number, fmt?: string): string {
  if (!fmt || fmt.trim().toLowerCase() === 'general') return formatGeneral(n);
  const out = formatWith(n, fmt);
  return out === NO_DATE ? DATE_OVERFLOW : out ?? formatGeneral(n);
}

/** TEXT(value, format): General gives up to 15 significant digits; undefined means #VALUE!. */
export function formatText(n: number, fmt: string): string | undefined {
  if (fmt.trim().toLowerCase() === 'general') return excelNumberText(n);
  const out = formatWith(n, fmt);
  return out === NO_DATE ? undefined : out;
}

/** True when SSF can use the code (used to reject typos in custom formats). */
export function isValidFormat(fmt: string): boolean {
  if (fmt.toLowerCase() === 'general') return true;
  try {
    SSF.format(fmt, 1234.5);
    return true;
  } catch {
    return false;
  }
}
