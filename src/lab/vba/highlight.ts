// Token colouring for the VBA editor, line by line, like the VBE: keywords, comments, strings and numbers.

export type TokenKind = 'kw' | 'comment' | 'str' | 'num' | 'text'
export interface Token { kind: TokenKind; text: string }

const KEYWORDS = new Set([
  'and', 'as', 'base', 'boolean', 'byref', 'byte', 'byval', 'call', 'case', 'compare', 'const', 'currency', 'date',
  'dim', 'do', 'double', 'each', 'else', 'elseif', 'empty', 'end', 'eqv', 'erase', 'error', 'exit', 'explicit',
  'false', 'for', 'function', 'goto', 'if', 'imp', 'in', 'integer', 'is', 'let', 'like', 'long', 'loop', 'mod', 'new',
  'next', 'not', 'nothing', 'null', 'object', 'on', 'option', 'optional', 'or', 'paramarray', 'preserve', 'print',
  'private', 'public', 'redim', 'resume', 'select', 'set', 'single', 'static', 'step', 'stop', 'string', 'sub', 'then',
  'to', 'true', 'until', 'variant', 'wend', 'while', 'with', 'xor',
])

const WORD = /[A-Za-z_][A-Za-z0-9_]*/y
const NUMBER = /(?:&H[0-9A-Fa-f]+|&O[0-7]+|\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?|\.\d+(?:[Ee][+-]?\d+)?)[%&!#@]?/y

export function tokenizeLine(line: string): Token[] {
  const out: Token[] = []
  const push = (kind: TokenKind, text: string) => {
    const last = out[out.length - 1]
    if (last && last.kind === kind && kind === 'text') last.text += text
    else out.push({ kind, text })
  }
  let i = 0
  let stmtStart = true                                  // Rem is a comment only where a statement can start
  while (i < line.length) {
    const ch = line[i]
    if (ch === "'") {
      push('comment', line.slice(i))
      break
    }
    if (ch === '"') {
      let j = i + 1
      while (j < line.length) {
        if (line[j] === '"' && line[j + 1] === '"') j += 2
        else if (line[j] === '"') break
        else j++
      }
      push('str', line.slice(i, Math.min(j + 1, line.length)))
      i = j + 1
      stmtStart = false
      continue
    }
    WORD.lastIndex = i
    const w = WORD.exec(line)
    if (w) {
      const word = w[0]
      const prev = line[i - 1]
      if (stmtStart && word.toLowerCase() === 'rem') {
        push('comment', line.slice(i))
        break
      }
      push(KEYWORDS.has(word.toLowerCase()) && prev !== '.' ? 'kw' : 'text', word)
      i += word.length
      stmtStart = false
      continue
    }
    NUMBER.lastIndex = i
    const n = /[0-9.&]/.test(ch) && !/[A-Za-z0-9_]/.test(line[i - 1] ?? '') ? NUMBER.exec(line) : null
    if (n && n[0] !== '.') {
      push('num', n[0])
      i += n[0].length
      stmtStart = false
      continue
    }
    if (ch === ':') stmtStart = true
    else if (ch !== ' ' && ch !== '\t') stmtStart = false
    push('text', ch)
    i++
  }
  return out
}
