// Block bookkeeping for the parser: which block a closing keyword belongs to, and the VBE's compile errors for a block
// left open ("Block If without End If") or a closer with no block ("Next without For").
import type { ParseError } from './ast.ts'

export type Block = 'if' | 'for' | 'do' | 'while' | 'select' | 'with' | 'proc'
export interface OpenBlock { kind: Block; line: number; proc?: string }

// what the block helpers need from the parser
interface Cursor {
  open: OpenBlock[]
  is(v: string): boolean
  isAt(k: number, v: string): boolean
  err(m: string): ParseError
}

export const UNCLOSED: Record<Exclude<Block, 'proc'>, string> = {
  if: 'Block If without End If', for: 'For without Next', do: 'Do without Loop', while: 'While without Wend',
  select: 'Select Case without End Select', with: 'With without End With',
}

const OPEN_CLOSE: Record<Exclude<Block, 'proc'>, [string, string]> = {
  if: ['If', 'End If'], for: ['For', 'Next'], do: ['Do', 'Loop'], while: ['While', 'Wend'], select: ['Select Case', 'End Select'],
  with: ['With', 'End With'],
}

// which kind of block the current token closes (or starts a new procedure)
export function closerKind(p: Cursor): Block | undefined {
  if (p.is('next')) return 'for'
  if (p.is('loop')) return 'do'
  if (p.is('wend')) return 'while'
  if (p.is('else') || p.is('elseif')) return 'if'
  if (p.is('case')) return 'select'
  if (p.is('end')) {
    if (p.isAt(1, 'if')) return 'if'
    if (p.isAt(1, 'select')) return 'select'
    if (p.isAt(1, 'with')) return 'with'
    if (p.isAt(1, 'sub') || p.isAt(1, 'function') || p.isAt(1, 'property')) return 'proc'
  }
  if (p.is('sub') || p.is('function')) return 'proc'
  if ((p.is('private') || p.is('public')) && (p.isAt(1, 'sub') || p.isAt(1, 'function'))) return 'proc'
  return undefined
}

// the innermost block is still open at End Sub (or the end of the module)
export function unclosedError(p: Cursor): ParseError {
  const o = p.open[p.open.length - 1]
  if (o.kind === 'proc') return p.err(`Expected End ${o.proc === 'function' ? 'Function' : 'Sub'}`)
  return { line: o.line, message: `Compile error: ${UNCLOSED[o.kind]}` }
}

// a closer that is not the innermost block's, reported where it stands; when an enclosing block would have taken it,
// the innermost block was left open, and the message says which
export function strayError(p: Cursor, blockLeftOpen: boolean): ParseError {
  const text = p.is('next') ? 'Next without For' : p.is('loop') ? 'Loop without Do' : p.is('wend') ? 'Wend without While'
    : p.is('else') || p.is('elseif') ? 'Else without If' : p.is('case') ? 'Case without Select Case'
      : p.isAt(1, 'if') ? 'End If without block If' : p.isAt(1, 'select') ? 'End Select without Select Case' : 'End With without With'
  const o = p.open[p.open.length - 1]
  if (!blockLeftOpen || o.kind === 'proc') return p.err(text)
  const [opener, closer] = OPEN_CLOSE[o.kind]
  return p.err(`${text} (the ${opener} on line ${o.line} has no ${closer})`)
}
