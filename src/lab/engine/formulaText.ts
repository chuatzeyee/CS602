// formulaText.ts - typed formula text <-> the text HyperFormula can parse. The engine form:
//   =@B4:B10          -> =SINGLE(B4:B10)              (Excel 365's implicit-intersection operator; SINGLE is its function form)
//   =1E-12            -> =1e-12                       (the engine's lexer only knows a lower-case exponent)
//   =SUMIF(A1:A9,x,C1)-> =SUMIF(A1:A9,x,C1,C1:C9)     (Excel resizes a sum/average range to the criteria range: the hidden
//                                                       4th argument makes the engine track those cells as dependencies)
// toDisplayFormula reverses the first and last rewrite, so raw() shows what the learner typed (normalised by the engine).
import { colIndex, colLetter } from '../refs';

type Kind = 'str' | 'ws' | 'func' | 'lp' | 'rp' | 'comma' | 'ref' | 'num' | 'err' | 'name' | 'at' | 'other';
interface Tok { kind: Kind; text: string }

const MAX_ROW = 1048576;
const MAX_COL = 16384;
const RESIZABLE = new Set(['SUMIF', 'AVERAGEIF']);
const CELL = String.raw`\$?[A-Za-z]{1,3}\$?\d+`;
const SHEET = String.raw`(?:'(?:[^']|'')*'|[A-Za-z_][A-Za-z0-9_.]*)!`;
const REF_AT = new RegExp(String.raw`^(?:${SHEET})?(?:${CELL}(?::${CELL})?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d+:\$?\d+)(?![A-Za-z0-9_.(!])`);
const NUM_AT = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const NAME_AT = /^[A-Za-z_\\][A-Za-z0-9_.]*/;
const ERR_AT = /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|SPILL!|CALC!|CYCLE!|ERROR!|GETTING_DATA)/i;
const OPS = ['<=', '>=', '<>'];

function tokenize(body: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < body.length) {
    const rest = body.slice(i);
    const c = body[i];
    let m: RegExpExecArray | null;
    if (c === '"') {
      let j = i + 1;
      while (j < body.length && !(body[j] === '"' && body[j + 1] !== '"')) j += body[j] === '"' ? 2 : 1;
      out.push({ kind: 'str', text: body.slice(i, j + 1) });
      i = j + 1;
    } else if (/\s/.test(c)) {
      const n = /^\s+/.exec(rest)?.[0] ?? c;
      out.push({ kind: 'ws', text: n });
      i += n.length;
    } else if (c === '[') {
      const j = body.indexOf(']', i);
      const end = j < 0 ? body.length : j + 1;
      out.push({ kind: 'other', text: body.slice(i, end) });
      i = end;
    } else if ((m = REF_AT.exec(rest)) && (/[A-Za-z$'_]/.test(c) || /^\$?\d+:\$?\d+/.test(m[0]))) {
      out.push({ kind: 'ref', text: m[0] });
      i += m[0].length;
    } else if ((m = NUM_AT.exec(rest)) && /[\d.]/.test(c)) {
      out.push({ kind: 'num', text: m[0] });
      i += m[0].length;
    } else if ((m = NAME_AT.exec(rest))) {
      const kind: Kind = body[i + m[0].length] === '(' ? 'func' : 'name';
      out.push({ kind, text: m[0] });
      i += m[0].length;
    } else if ((m = ERR_AT.exec(rest))) {
      out.push({ kind: 'err', text: m[0] });
      i += m[0].length;
    } else {
      const op = OPS.find((o) => rest.startsWith(o));
      const text = op ?? c;
      const kind: Kind = c === '(' ? 'lp' : c === ')' ? 'rp' : c === ',' ? 'comma' : c === '@' ? 'at' : 'other';
      out.push({ kind: op ? 'other' : kind, text });
      i += text.length;
    }
  }
  return out;
}

/** index of the ')' that closes the '(' at `open`, or undefined */
function closing(toks: Tok[], open: number, to: number): number | undefined {
  let depth = 0;
  for (let i = open; i < to; i++) {
    if (toks[i].kind === 'lp') depth++;
    else if (toks[i].kind === 'rp' && --depth === 0) return i;
  }
  return undefined;
}

/** [from, to) token spans of the top-level arguments between '(' at open and its ')' at close */
function argSpans(toks: Tok[], open: number, close: number): [number, number][] {
  const spans: [number, number][] = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open + 1; i < close; i++) {
    const k = toks[i].kind;
    if (k === 'lp' || (k === 'other' && toks[i].text === '{')) depth++;
    else if (k === 'rp' || (k === 'other' && toks[i].text === '}')) depth--;
    else if (k === 'comma' && depth === 0) {
      spans.push([start, i]);
      start = i + 1;
    }
  }
  if (close > open + 1 || spans.length) spans.push([start, close]);
  return spans;
}

const solid = (toks: Tok[], [a, b]: [number, number]): [number, number] => {
  let s = a;
  let e = b;
  while (s < e && toks[s].kind === 'ws') s++;
  while (e > s && toks[e - 1].kind === 'ws') e--;
  return [s, e];
};
const textOf = (toks: Tok[], a: number, b: number): string => toks.slice(a, b).map((t) => t.text).join('');

/** end (exclusive) of the operand that starts at `i`: a reference, name, literal, function call or bracketed group */
function operandEnd(toks: Tok[], i: number, to: number): number | undefined {
  const t = toks[i];
  if (!t) return undefined;
  if (t.kind === 'ref' || t.kind === 'name' || t.kind === 'num' || t.kind === 'str' || t.kind === 'err') return i + 1;
  if (t.kind === 'func' && toks[i + 1]?.kind === 'lp') {
    const c = closing(toks, i + 1, to);
    return c === undefined ? undefined : c + 1;
  }
  if (t.kind === 'lp') {
    const c = closing(toks, i, to);
    return c === undefined ? undefined : c + 1;
  }
  return undefined;
}

interface RefParts { c1: number; r1: number; c2: number; r2: number; ac1: boolean; ar1: boolean; ac2: boolean; ar2: boolean }
function refParts(text: string | undefined): RefParts | undefined {
  if (text === undefined) return undefined;
  const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?::(\$?)([A-Za-z]{1,3})(\$?)(\d+))?$/.exec(text);
  if (!m) return undefined;
  const one = { c: colIndex(m[2].toUpperCase()), r: Number(m[4]) - 1, ac: m[1] === '$', ar: m[3] === '$' };
  const two = m[6] === undefined ? one : { c: colIndex(m[6].toUpperCase()), r: Number(m[8]) - 1, ac: m[5] === '$', ar: m[7] === '$' };
  const [top, bottom] = one.r <= two.r ? [one, two] : [two, one];
  const [left, right] = one.c <= two.c ? [one, two] : [two, one];
  return { c1: left.c, r1: top.r, c2: right.c, r2: bottom.r, ac1: left.ac, ar1: top.ar, ac2: right.ac, ar2: bottom.ar };
}

/** The range Excel actually sums when sum_range has another shape than range, as a reference that keeps its meaning
 *  when the formula is filled; undefined when sum_range already covers it or it cannot be written that way. */
export function resizedSumRange(rangeText: string | undefined, sumText: string | undefined): string | undefined {
  const r = refParts(rangeText);
  const s = refParts(sumText);
  if (!r || !s) return undefined;
  const h = r.r2 - r.r1 + 1;
  const w = r.c2 - r.c1 + 1;
  if (s.r2 - s.r1 + 1 >= h && s.c2 - s.c1 + 1 >= w) return undefined;
  const rel = (abs: boolean) => (abs ? 0 : 1);
  const relRow = rel(s.ar1) + rel(r.ar2) - rel(r.ar1);
  const relCol = rel(s.ac1) + rel(r.ac2) - rel(r.ac1);
  const endRow = s.r1 + h - 1;
  const endCol = s.c1 + w - 1;
  if (relRow < 0 || relRow > 1 || relCol < 0 || relCol > 1 || endRow >= MAX_ROW || endCol >= MAX_COL) return undefined;
  const cell = (c: number, row: number, ac: boolean, ar: boolean) => `${ac ? '$' : ''}${colLetter(c)}${ar ? '$' : ''}${row + 1}`;
  return `${cell(s.c1, s.r1, s.ac1, s.ar1)}:${cell(endCol, endRow, relCol === 0, relRow === 0)}`;
}

function refArg(toks: Tok[], span: [number, number]): string | undefined {
  const [a, b] = solid(toks, span);
  return b - a === 1 && toks[a].kind === 'ref' ? toks[a].text : undefined;
}

function toEngine(toks: Tok[], from: number, to: number): string {
  let out = '';
  for (let i = from; i < to; i++) {
    const t = toks[i];
    if (t.kind === 'num') {
      out += t.text.replace('E', 'e');
    } else if (t.kind === 'at') {
      let j = i + 1;
      while (j < to && (toks[j].kind === 'ws' || toks[j].kind === 'at')) j++; // @@x is @x
      const end = operandEnd(toks, j, to);
      if (end === undefined) {
        out += t.text;
        continue;
      }
      out += `SINGLE(${toEngine(toks, j, end)})`;
      i = end - 1;
    } else if (t.kind === 'func' && RESIZABLE.has(t.text.toUpperCase()) && toks[i + 1]?.kind === 'lp') {
      const close = closing(toks, i + 1, to);
      if (close === undefined) {
        out += t.text;
        continue;
      }
      const spans = argSpans(toks, i + 1, close);
      const extra = spans.length === 3 ? resizedSumRange(refArg(toks, spans[0]), refArg(toks, spans[2])) : undefined;
      out += `${t.text}(${spans.map(([a, b]) => toEngine(toks, a, b)).join(',')}${extra ? `,${extra}` : ''})`;
      i = close;
    } else {
      out += t.text;
    }
  }
  return out;
}

function isPrimary(toks: Tok[], [a, b]: [number, number]): boolean {
  if (b - a === 1) return ['ref', 'name', 'num', 'str', 'err'].includes(toks[a].kind);
  const end = operandEnd(toks, a, b);
  return end === b && (toks[a].kind === 'func' || toks[a].kind === 'lp');
}

function toDisplay(toks: Tok[], from: number, to: number): string {
  let out = '';
  for (let i = from; i < to; i++) {
    const t = toks[i];
    const name = t.kind === 'func' ? t.text.toUpperCase() : '';
    const close = name && toks[i + 1]?.kind === 'lp' ? closing(toks, i + 1, to) : undefined;
    if (close !== undefined && name === 'SINGLE') {
      const spans = argSpans(toks, i + 1, close);
      if (spans.length === 1) {
        const span = solid(toks, spans[0]);
        const inner = toDisplay(toks, span[0], span[1]);
        out += isPrimary(toks, span) ? `@${inner}` : `@(${inner})`;
        i = close;
        continue;
      }
    }
    if (close !== undefined && RESIZABLE.has(name)) {
      const spans = argSpans(toks, i + 1, close);
      const hidden = spans.length === 4 ? solid(toks, spans[3]) : undefined;
      const resized = hidden ? resizedSumRange(refArg(toks, spans[0]), refArg(toks, spans[2])) : undefined;
      if (hidden && resized !== undefined && textOf(toks, hidden[0], hidden[1]).toUpperCase() === resized.toUpperCase()) {
        out += `${t.text}(${spans.slice(0, 3).map(([a, b]) => toDisplay(toks, a, b)).join(',')})`;
        i = close;
        continue;
      }
    }
    out += t.text;
  }
  return out;
}

const ENGINE_WORK = /@|[\d.][eE]|SUMIF|AVERAGEIF/i;
const DISPLAY_WORK = /SINGLE\s*\(|SUMIF\s*\(|AVERAGEIF\s*\(/i;

/** Typed formula -> the text handed to the engine (unchanged when nothing needs rewriting). */
export function toEngineFormula(formula: string): string {
  if (!formula.startsWith('=') || !ENGINE_WORK.test(formula)) return formula;
  const toks = tokenize(formula.slice(1));
  return `=${toEngine(toks, 0, toks.length)}`;
}

/** Engine formula -> the text shown in the formula bar (reverses the @ and resized-range rewrites). */
export function toDisplayFormula(formula: string): string {
  if (!formula.startsWith('=') || !DISPLAY_WORK.test(formula)) return formula;
  const toks = tokenize(formula.slice(1));
  return `=${toDisplay(toks, 0, toks.length)}`;
}
