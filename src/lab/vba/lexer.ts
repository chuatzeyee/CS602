// VBA lexer: source text -> tokens with their 1-based lines. Comments and line continuations are dropped here.

export interface Tok { t: 'id' | 'num' | 'str' | 'date' | 'op' | 'nl'; v: string; line: number; sp: boolean; num?: number; nt?: 'int' | 'long' | 'double' | 'single' | 'currency' }

function dateSerial(text: string): number {
  const t = text.trim()
  let serial = 0
  const dm = /^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})/.exec(t)
  let rest = t
  if (dm) {
    let [m, d, y] = [Number(dm[1]), Number(dm[2]), Number(dm[3])]
    if (dm[1].length === 4) [y, m, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])]
    serial = (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000
    rest = t.slice(dm[0].length).trim()
  }
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(rest)
  if (tm) {
    let h = Number(tm[1])
    if (tm[4]) h = (h % 12) + (tm[4].toUpperCase() === 'PM' ? 12 : 0)
    serial += (h * 3600 + Number(tm[2]) * 60 + Number(tm[3] ?? 0)) / 86400
  }
  return serial
}

// sticky patterns, matched at a position (no slicing of the rest of the module for every token)
const CONT = /_[ \t]*\n/y
const DATE = /#[0-9][^#\n]*#/y
const HEX = /&([Hh][0-9A-Fa-f]+|[Oo][0-7]+)(&?)/y
const NUM = /(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?([%&!#@])?/y
const ID = /[A-Za-z_][A-Za-z0-9_]*[$%&!#@]?/y
const OP = /(:=|<=|>=|<>|[-+*/\\^&=<>(),.:;!])/y
function at(re: RegExp, text: string, i: number): RegExpExecArray | null {
  re.lastIndex = i
  return re.exec(text)
}

export function lex(src: string): Tok[] {
  const toks: Tok[] = []
  const text = src.replace(/\r\n?/g, '\n')
  let line = 1
  let i = 0
  let sp = false
  while (i < text.length) {
    const c = text[i]
    if (c === ' ' || c === '\t' || /[\u00a0\u2000-\u200b\u3000\ufeff]/.test(c)) { sp = true; i++; continue }   // pasted non-breaking spaces too
    if (c === '_' && at(CONT, text, i) && (i === 0 || /[ \t]/.test(text[i - 1]))) {
      i = text.indexOf('\n', i) + 1; line++; sp = true; continue
    }
    if (c === '\n') { toks.push({ t: 'nl', v: '\n', line, sp }); line++; i++; sp = false; continue }
    if (c === "'") { while (i < text.length && text[i] !== '\n') i++; continue }
    if (/^rem\b/i.test(text.slice(i, i + 4)) && (toks.length === 0 || toks[toks.length - 1].t === 'nl' || toks[toks.length - 1].v === ':')) {
      while (i < text.length && text[i] !== '\n') i++; continue
    }
    if (c === '"') {
      // like the VBE, a string left open is closed at the end of its line
      let s = ''
      i++
      while (i < text.length && text[i] !== '\n') {
        if (text[i] === '"' && text[i + 1] === '"') { s += '"'; i += 2; continue }
        if (text[i] === '"') { i++; break }
        s += text[i++]
      }
      toks.push({ t: 'str', v: s, line, sp }); sp = false; continue
    }
    if (c === '#' && at(DATE, text, i)) {
      const j = text.indexOf('#', i + 1)
      toks.push({ t: 'date', v: text.slice(i + 1, j), line, sp, num: dateSerial(text.slice(i + 1, j)) }); i = j + 1; sp = false; continue
    }
    const hex = at(HEX, text, i)
    if (hex) {
      // &HFFFF is the Integer -1 and &HFFFF& the Long 65535: an Integer when it fits 16 bits and has no & suffix
      let x = parseInt(hex[1].slice(1), /^[Hh]/.test(hex[1]) ? 16 : 8)
      const asInt = hex[2] === '' && x <= 0xffff
      if (asInt && x > 0x7fff) x -= 0x10000
      else if (!asInt && x > 0x7fffffff && x <= 0xffffffff) x -= 0x100000000
      toks.push({ t: 'num', v: hex[0], line, sp, num: x, nt: asInt ? 'int' : 'long' }); i += hex[0].length; sp = false; continue
    }
    const num = at(NUM, text, i)
    if (num) {
      const x = Number(num[1] + (num[2] ?? ''))
      const nt: Tok['nt'] = num[3] === '%' ? 'int' : num[3] === '&' ? 'long' : num[3] === '!' ? 'single' : num[3] === '#' ? 'double' : num[3] === '@' ? 'currency'
        : /[.eE]/.test(num[1] + (num[2] ?? '')) ? 'double' : x <= 32767 ? 'int' : x <= 2147483647 ? 'long' : 'double'
      toks.push({ t: 'num', v: num[0], line, sp, num: x, nt }); i += num[0].length; sp = false; continue
    }
    const id = at(ID, text, i)
    if (id) {
      const v = id[0].replace(/[$%&!#@]$/, '')   // Left$ = Left: type suffixes are dropped
      toks.push({ t: 'id', v, line, sp }); i += id[0].length; sp = false; continue
    }
    const op = at(OP, text, i)
    if (op) { toks.push({ t: 'op', v: op[0], line, sp }); i += op[0].length; sp = false; continue }
    // curly quotes come from code copied out of Word, PDFs or slides
    const hint = /[\u2018\u2019\u201c\u201d]/.test(c) ? `: type straight quotes (" for text, ' for a comment) instead of curly ones` : ''
    throw { line, message: `Compile error: Invalid character (${c})${hint}` }
  }
  toks.push({ t: 'nl', v: '\n', line, sp: false })
  return toks
}

