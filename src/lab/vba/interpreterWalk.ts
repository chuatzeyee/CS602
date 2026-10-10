// Walking every expression and statement of a procedure body (used by the compile-time checks).
import type { Expr, Stmt } from './ast'
import { childBlocks } from './interpreterDecl'

export type Visit = (e: Expr, line: number, asCallTarget: boolean) => void

export function walkExpr(e: Expr | null | undefined, line: number, visit: Visit, asCallTarget = false): void {
  if (!e) return
  visit(e, line, asCallTarget)
  switch (e.k) {
    case 'member': walkExpr(e.obj, line, visit); break
    case 'call':
      walkExpr(e.target, line, visit, true)
      for (const a of e.args) walkExpr(a.value, line, visit)
      break
    case 'paren': case 'unary': walkExpr(e.e, line, visit); break
    case 'bin': walkExpr(e.l, line, visit); walkExpr(e.r, line, visit); break
    default: break
  }
}

export function walkStmts(stmts: Stmt[], visit: Visit, onStmt: (s: Stmt) => void): void {
  for (const s of stmts) {
    onStmt(s)
    const L = s.line
    switch (s.k) {
      case 'assign': walkExpr(s.target, L, visit); walkExpr(s.value, L, visit); break
      case 'call':
        walkExpr(s.target, L, visit, true)
        for (const a of s.args) walkExpr(a.value, L, visit)
        break
      case 'if': for (const b of s.branches) walkExpr(b.cond, L, visit); break
      case 'select':
        walkExpr(s.subject, L, visit)
        for (const c of s.cases) {
          for (const t of c.tests) {
            if (t.k === 'range') { walkExpr(t.from, c.line, visit); walkExpr(t.to, c.line, visit) } else walkExpr(t.e, c.line, visit)
          }
        }
        break
      case 'for': walkExpr(s.counter, L, visit); walkExpr(s.from, L, visit); walkExpr(s.to, L, visit); walkExpr(s.step, L, visit); break
      case 'forEach': walkExpr(s.item, L, visit); walkExpr(s.group, L, visit); break
      case 'do': walkExpr(s.pre?.cond, L, visit); walkExpr(s.post?.cond, L, visit); break
      case 'while': walkExpr(s.cond, L, visit); break
      case 'with': walkExpr(s.obj, L, visit); break
      case 'print': for (const it of s.items) walkExpr(it.e, L, visit); break
      case 'redim': for (const it of s.items) for (const b of it.bounds) { walkExpr(b.lo, L, visit); walkExpr(b.hi, L, visit) } break
      case 'const': for (const c of s.items) walkExpr(c.value, L, visit); break
      case 'dim': for (const d of s.vars) for (const b of d.bounds ?? []) { walkExpr(b.lo, L, visit); walkExpr(b.hi, L, visit) } break
      default: break
    }
    for (const body of childBlocks(s)) walkStmts(body, visit, onStmt)
  }
}
