// dateText.ts - dates and times written as text, read the way Excel (DD/MM locale) reads a typed entry:
// '2026-10-10', '10/10/2026', '29 Jun 2026', '29-Jun', 'Jun 29, 2026', '9:30', '6:45 PM', '26:30'.
// Pure; shared by cell entry (input.ts) and criteria strings (excelMath.ts).

export interface DateTimeText { value: number; fmt: string }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const FULL_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Excel 1900-system serial (with the fictitious 29-Feb-1900), undefined for impossible dates. */
export function dateSerial(y: number, m: number, d: number): number | undefined {
  if (y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1) return undefined;
  const date = new Date(Date.UTC(2000, 0, 1));
  date.setUTCFullYear(y, m - 1, d);
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  const serial = Math.round((date.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
  return serial < 61 ? serial - 1 : serial;
}

const fullYear = (text: string): number => {
  const y = Number(text);
  return text.length > 2 ? y : y < 30 ? 2000 + y : 1900 + y;
};
const monthOf = (name: string): number => {
  const lower = name.toLowerCase();
  const i = MONTHS.indexOf(lower.slice(0, 3));
  return i >= 0 && (lower.length === 3 || FULL_MONTHS[i] === lower || (lower === 'sept' && i === 8)) ? i + 1 : 0;
};
const pad = (part: string, letter: string): string => (part.length > 1 ? letter + letter : letter);

/** A date typed as text -> serial and the format Excel would apply; undefined when it is not a date. */
export function parseDateText(t: string): DateTimeText | undefined {
  let m = /^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/.exec(t);
  if (m) {
    const v = dateSerial(Number(m[1]), Number(m[3]), Number(m[4]));
    return v === undefined ? undefined : { value: v, fmt: `yyyy${m[2]}mm${m[2]}dd` };
  }
  m = /^(\d{1,2})([-/])(\d{1,2})\2(\d{2}|\d{4})$/.exec(t); // DD/MM/YYYY like the engine's dateFormats
  if (m) {
    const v = dateSerial(fullYear(m[4]), Number(m[3]), Number(m[1]));
    return v === undefined ? undefined : { value: v, fmt: `${pad(m[1], 'd')}${m[2]}${pad(m[3], 'm')}${m[2]}${m[4].length > 2 ? 'yyyy' : 'yy'}` };
  }
  m = /^(\d{1,2})([- ])([A-Za-z]{3,9})(?:\2(\d{2}|\d{4}))?$/.exec(t);
  if (m) {
    const month = monthOf(m[3]);
    const year = m[4] === undefined ? new Date().getFullYear() : fullYear(m[4]);
    const v = month ? dateSerial(year, month, Number(m[1])) : undefined;
    const yearFmt = m[4] === undefined ? '' : `${m[2]}${m[4].length > 2 ? 'yyyy' : 'yy'}`;
    return v === undefined ? undefined : { value: v, fmt: `${pad(m[1], 'd')}${m[2]}mmm${yearFmt}` };
  }
  m = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/.exec(t);
  if (m) {
    const month = monthOf(m[1]);
    const v = month ? dateSerial(Number(m[3]), month, Number(m[2])) : undefined;
    return v === undefined ? undefined : { value: v, fmt: 'mmm d, yyyy' };
  }
  return undefined;
}

/** A time typed as text -> day fraction and the format Excel would apply; undefined when it is not a time. */
export function parseTimeText(t: string): DateTimeText | undefined {
  const m = /^(\d{1,4}):(\d{2})(?::(\d{2}(?:\.\d+)?))?\s*([AaPp][Mm]?)?$/.exec(t);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] === undefined ? 0 : Number(m[3]);
  if (min > 59 || sec >= 60) return undefined;
  const ampm = m[4]?.[0].toLowerCase();
  if (ampm) {
    if (h > 12) return undefined;
    if (ampm === 'p' && h < 12) h += 12;
    if (ampm === 'a' && h === 12) h = 0;
  }
  const secs = m[3] === undefined ? '' : ':ss';
  const fmt = ampm ? `h:mm${secs} AM/PM` : h > 23 ? `[h]:mm${secs}` : `h:mm${secs}`;
  return { value: (h * 3600 + min * 60 + sec) / 86400, fmt };
}
