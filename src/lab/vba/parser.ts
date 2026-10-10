// VBA parser: tokens (lexer.ts) -> the AST in ast.ts. Recursive descent with VBA's operator precedence.
import type { Arg, Bound, CaseTest, Expr, Module, ParseError, Param, PrintItem, Proc, Stmt, TypeRef, VarDecl } from './ast.ts'
import { lex, type Tok } from './lexer.ts'
import { closerKind, strayError, unclosedError, UNCLOSED, type Block, type OpenBlock } from './parserBlocks.ts'

const KW = new Set(['then', 'else', 'elseif', 'to', 'step', 'next', 'loop', 'wend', 'end', 'case', 'and', 'or', 'xor', 'eqv', 'imp', 'mod', 'not', 'like', 'is', 'in'])

class P {
  toks: Tok[]
  i = 0
  open: OpenBlock[] = []   // the blocks being parsed, innermost last
  constructor(toks: Tok[]) { this.toks = toks }
  get cur(): Tok { return this.toks[Math.min(this.i, this.toks.length - 1)] }   // past the end: the final newline
  peek(k = 1): Tok { return this.toks[Math.min(this.i + k, this.toks.length - 1)] }
  is(v: string): boolean { const c = this.cur; return (c.t === 'id' || c.t === 'op') && c.v.toLowerCase() === v }
  isAt(k: number, v: string): boolean { const c = this.peek(k); return (c.t === 'id' || c.t === 'op') && c.v.toLowerCase() === v }
  eat(v: string): boolean { if (this.is(v)) { this.i++; return true } return false }
  want(v: string): void {
    if (this.eat(v)) return
    throw this.err(`Expected: ${v === 'then' ? 'Then or GoTo' : /^[a-z]/.test(v) ? v[0].toUpperCase() + v.slice(1) : v}`)
  }
  err(m: string): ParseError { return { line: this.cur.line, message: `Compile error: ${m}` } }
  atEol(): boolean { return this.cur.t === 'nl' }   // a method, so TypeScript doesn't narrow this.cur across calls
  eos(): boolean { return this.cur.t === 'nl' || this.is(':') || (this.is('else') && this.inSingleIf > 0) }
  inSingleIf = 0
  id(): string { const c = this.cur; if (c.t !== 'id') throw this.err('Expected: identifier'); this.i++; return c.v }

  // ---------- expressions ----------
  expr(): Expr { return this.imp() }
  imp(): Expr { let l = this.eqv(); while (this.eat('imp')) l = { k: 'bin', op: 'imp', l, r: this.eqv() }; return l }
  eqv(): Expr { let l = this.xor(); while (this.eat('eqv')) l = { k: 'bin', op: 'eqv', l, r: this.xor() }; return l }
  xor(): Expr { let l = this.or(); while (this.eat('xor')) l = { k: 'bin', op: 'xor', l, r: this.or() }; return l }
  or(): Expr { let l = this.and(); while (this.eat('or')) l = { k: 'bin', op: 'or', l, r: this.and() }; return l }
  and(): Expr { let l = this.not(); while (this.eat('and')) l = { k: 'bin', op: 'and', l, r: this.not() }; return l }
  not(): Expr { if (this.eat('not')) return { k: 'unary', op: 'not', e: this.not() }; return this.cmp() }
  cmp(): Expr {
    let l = this.cat()
    for (;;) {
      const op = ['=', '<>', '<=', '>=', '<', '>', 'like', 'is'].find(o => this.is(o))
      if (!op) return l
      this.i++
      l = { k: 'bin', op: op as never, l, r: this.cat() }
    }
  }
  cat(): Expr { let l = this.add(); while (this.eat('&')) l = { k: 'bin', op: '&', l, r: this.add() }; return l }
  add(): Expr { let l = this.mod(); for (;;) { if (this.eat('+')) l = { k: 'bin', op: '+', l, r: this.mod() }; else if (this.eat('-')) l = { k: 'bin', op: '-', l, r: this.mod() }; else return l } }
  mod(): Expr { let l = this.idiv(); while (this.eat('mod')) l = { k: 'bin', op: 'mod', l, r: this.idiv() }; return l }
  idiv(): Expr { let l = this.mul(); while (this.eat('\\')) l = { k: 'bin', op: '\\', l, r: this.mul() }; return l }
  mul(): Expr { let l = this.neg(); for (;;) { if (this.eat('*')) l = { k: 'bin', op: '*', l, r: this.neg() }; else if (this.eat('/')) l = { k: 'bin', op: '/', l, r: this.neg() }; else return l } }
  neg(): Expr { if (this.eat('-')) return { k: 'unary', op: '-', e: this.neg() }; if (this.eat('+')) return { k: 'unary', op: '+', e: this.neg() }; return this.pow() }
  pow(): Expr { let l = this.postfix(); while (this.eat('^')) { const r = this.is('-') ? (this.i++, { k: 'unary', op: '-', e: this.postfix() } as Expr) : this.postfix(); l = { k: 'bin', op: '^', l, r } } return l }
  args(): Arg[] {
    const out: Arg[] = []
    if (this.is(')')) return out
    for (;;) {
      if (this.is(',')) out.push({ value: { k: 'missing' } })
      else if (this.cur.t === 'id' && this.isAt(1, ':=')) { const name = this.id(); this.i++; out.push({ name, value: this.expr() }) }
      else out.push({ value: this.expr() })
      if (!this.eat(',')) return out
      if (this.is(')')) { out.push({ value: { k: 'missing' } }); return out }
    }
  }
  postfix(stmtStart = false): Expr {
    let e = this.primary()
    for (;;) {
      if (this.is('.') ) { this.i++; e = { k: 'member', obj: e, name: this.id() }; continue }
      if (this.is('!') && this.peek().t === 'id') { this.i++; e = { k: 'call', target: e, args: [{ value: { k: 'str', v: this.id() } }] }; continue }
      if (this.is('(') && !(stmtStart && this.cur.sp)) { this.i++; const a = this.args(); this.want(')'); e = { k: 'call', target: e, args: a }; continue }
      return e
    }
  }
  primary(): Expr {
    const c = this.cur
    if (c.t === 'num') { this.i++; return { k: 'num', v: c.num!, type: c.nt! } }
    if (c.t === 'str') { this.i++; return { k: 'str', v: c.v } }
    if (c.t === 'date') { this.i++; return { k: 'date', v: c.num! } }
    if (this.eat('(')) { const e = this.expr(); this.want(')'); return { k: 'paren', e } }
    if (this.is('.')) { this.i++; return { k: 'member', obj: null, name: this.id() } }
    if (c.t === 'id') {
      const v = c.v.toLowerCase()
      if (v === 'true' || v === 'false') { this.i++; return { k: 'bool', v: v === 'true' } }
      if (v === 'nothing') { this.i++; return { k: 'nothing' } }
      if (v === 'empty') { this.i++; return { k: 'empty' } }
      if (v === 'null') { this.i++; return { k: 'null' } }
      if (v === 'new') { this.i++; return { k: 'new', className: this.id() } }
      if (KW.has(v)) throw this.err('Expected: expression')
      this.i++
      return { k: 'name', name: c.v }
    }
    throw this.err('Expected: expression')
  }

  // ---------- statements ----------
  typeRef(): TypeRef | undefined {
    if (!this.eat('as')) return undefined
    this.eat('new')
    let name = this.id()
    while (this.eat('.')) name = this.id()
    if (this.eat('*')) return { name, fixedLen: this.cur.num ?? (this.i++, 0) }
    return { name }
  }
  bounds(): Bound[] {
    const out: Bound[] = []
    if (this.is(')')) return out
    do {
      const a = this.expr()
      if (this.eat('to')) out.push({ lo: a, hi: this.expr() })
      else out.push({ hi: a })
    } while (this.eat(','))
    return out
  }
  varDecl(): VarDecl {
    this.eat('withevents')
    const name = this.id()
    const d: VarDecl = { name }
    if (this.eat('(')) { const b = this.bounds(); this.want(')'); if (b.length) d.bounds = b; else d.dynamicArray = true }
    if (this.is('as') && this.isAt(1, 'new')) d.isNew = true
    d.type = this.typeRef()
    return d
  }
  dim(scope: 'dim' | 'static' | 'private' | 'public', line: number): Stmt {
    if (this.is('const')) { this.i++; return this.constStmt(line) }
    const vars: VarDecl[] = []
    do vars.push(this.varDecl()); while (this.eat(','))
    return { k: 'dim', scope, vars, line }
  }
  constStmt(line: number): Stmt {
    const items: { name: string; type?: TypeRef; value: Expr }[] = []
    do { const name = this.id(); const type = this.typeRef(); this.want('='); items.push({ name, type, value: this.expr() }) } while (this.eat(','))
    return { k: 'const', items, line }
  }
  endOf(...words: string[]): boolean {
    if (this.is('end') && words.some(w => this.isAt(1, w))) return true
    return words.some(w => w !== 'sub' && w !== 'function' && w !== 'if' && w !== 'select' && w !== 'with' && this.is(w))
  }
  sep(): void { while (this.i < this.toks.length - 1 && (this.cur.t === 'nl' || this.is(':'))) this.i++ }
  // the statements of a block up to its closing keyword (`stop`). At End Sub (or the end of the module) an open block is
  // "Block If without End If" at its first line. Any other closer that is not this block's is reported where it stands,
  // as the VBE does ("Next without For" for a For whose inner If lacks End If), naming the block left open.
  block(stop: () => boolean, kind: Block, line: number, proc?: string): Stmt[] {
    this.open.push({ kind, line, proc })
    try {
      const out: Stmt[] = []
      for (;;) {
        this.sep()
        if (this.i >= this.toks.length - 1) throw this.unclosed()
        if (stop()) return out
        const closes = this.closerKind()
        if (closes === 'proc') throw this.unclosed()
        if (closes) throw this.stray(this.open.slice(0, -1).some(o => o.kind === closes))
        out.push(...this.stmt())
      }
    } finally {
      this.open.pop()
    }
  }
  closerKind(): Block | undefined { return closerKind(this) }
  unclosed(): ParseError { return unclosedError(this) }
  stray(blockLeftOpen: boolean): ParseError { return strayError(this, blockLeftOpen) }
  stmt(): Stmt[] {
    const c = this.cur
    const line = c.line
    if ((c.t === 'id' && this.isAt(1, ':') && !KW.has(c.v.toLowerCase()) && (this.i === 0 || this.toks[this.i - 1].t === 'nl')) || (c.t === 'num' && (this.i === 0 || this.toks[this.i - 1].t === 'nl'))) {
      this.i++
      if (c.t === 'id') this.i++
      return [{ k: 'label', name: c.t === 'num' ? String(c.num) : c.v, line }]
    }
    const w = c.t === 'id' ? c.v.toLowerCase() : ''
    switch (w) {
      case 'dim': this.i++; return [this.dim('dim', line)]
      case 'static': this.i++; return [this.dim('static', line)]
      case 'const': this.i++; return [this.constStmt(line)]
      case 'redim': {
        this.i++
        const preserve = this.eat('preserve')
        const items: { name: string; bounds: Bound[]; type?: TypeRef }[] = []
        do { const name = this.id(); this.want('('); const bounds = this.bounds(); this.want(')'); items.push({ name, bounds, type: this.typeRef() }) } while (this.eat(','))
        return [{ k: 'redim', preserve, items, line }]
      }
      case 'if': return [this.ifStmt(line)]
      case 'select': {
        this.i++
        this.want('case')
        const subject = this.expr()
        const cases: { line: number; tests: CaseTest[]; body: Stmt[] }[] = []
        let elseBody: Stmt[] | undefined
        this.sep()
        if (!this.is('case') && !this.endOf('select')) {
          if (this.i >= this.toks.length - 1 || this.closerKind()) throw { line, message: `Compile error: ${UNCLOSED.select}` }
          throw this.err('Statements and labels invalid between Select Case and first Case')
        }
        while (this.is('case')) {
          const cl = this.cur.line
          this.i++
          if (this.eat('else')) { elseBody = this.block(() => this.is('case') || this.endOf('select'), 'select', line); continue }
          const tests: CaseTest[] = []
          do {
            if (this.eat('is')) {
              if (!['=', '<>', '<', '>', '<=', '>='].includes(this.cur.v)) throw this.err('Expected: comparison operator')
              const op = this.cur.v as never; this.i++; tests.push({ k: 'is', op, e: this.expr() })
            }
            else { const a = this.expr(); if (this.eat('to')) tests.push({ k: 'range', from: a, to: this.expr() }); else tests.push({ k: 'value', e: a }) }
          } while (this.eat(','))
          cases.push({ line: cl, tests, body: this.block(() => this.is('case') || this.endOf('select'), 'select', line) })
        }
        this.want('end'); this.want('select')
        return [{ k: 'select', subject, cases, elseBody, line }]
      }
      case 'for': {
        this.i++
        if (this.eat('each')) {
          const item: Expr = { k: 'name', name: this.id() }
          this.want('in')
          const group = this.expr()
          const body = this.block(() => this.is('next'), 'for', line)
          const endLine = this.cur.line
          this.want('next'); if (this.cur.t === 'id') this.i++
          return [{ k: 'forEach', item, group, body, line, endLine }]
        }
        const counter: Expr = { k: 'name', name: this.id() }
        this.want('=')
        const from = this.expr(); this.want('to'); const to = this.expr()
        const step = this.eat('step') ? this.expr() : undefined
        const body = this.block(() => this.is('next'), 'for', line)
        const endLine = this.cur.line
        this.want('next')
        if (this.cur.t === 'id') { this.i++; if (this.is(',')) { /* Next i, j */ this.toks.splice(this.i, 1, { ...this.cur, t: 'id', v: 'next' }) } }
        return [{ k: 'for', counter, from, to, step, body, line, endLine }]
      }
      case 'do': {
        this.i++
        let pre: { until: boolean; cond: Expr } | undefined
        if (this.is('while') || this.is('until')) { const until = this.is('until'); this.i++; pre = { until, cond: this.expr() } }
        const body = this.block(() => this.is('loop'), 'do', line)
        const endLine = this.cur.line
        this.want('loop')
        let post: { until: boolean; cond: Expr } | undefined
        if (this.is('while') || this.is('until')) { const until = this.is('until'); this.i++; post = { until, cond: this.expr() } }
        return [{ k: 'do', pre, post, body, line, endLine }]
      }
      case 'while': { this.i++; const cond = this.expr(); const body = this.block(() => this.is('wend'), 'while', line); this.want('wend'); return [{ k: 'while', cond, body, line }] }
      case 'exit': { this.i++; const what = this.id().toLowerCase() as 'sub' | 'function' | 'for' | 'do'; return [{ k: 'exit', what: what === ('property' as string) ? 'sub' : what, line }] }
      case 'with': { this.i++; const obj = this.expr(); const body = this.block(() => this.endOf('with'), 'with', line); this.want('end'); this.want('with'); return [{ k: 'with', obj, body, line }] }
      case 'goto': { this.i++; const t = this.cur; this.i++; return [{ k: 'goto', label: t.t === 'num' ? String(t.num) : t.v, line }] }
      case 'on': {
        this.i++; this.want('error')
        if (this.eat('resume')) { this.want('next'); return [{ k: 'onError', mode: 'resumeNext', line }] }
        this.want('goto')
        const t = this.cur; this.i++
        if (t.t === 'num' && t.num === 0) return [{ k: 'onError', mode: 'goto0', line }]
        return [{ k: 'onError', mode: 'goto', label: t.t === 'num' ? String(t.num) : t.v, line }]
      }
      case 'resume': {
        this.i++
        if (this.eat('next')) return [{ k: 'resume', mode: 'next', line }]
        if (this.eos()) return [{ k: 'resume', mode: 'same', line }]
        const t = this.cur; this.i++
        if (t.t === 'num' && t.num === 0) return [{ k: 'resume', mode: 'same', line }]
        return [{ k: 'resume', mode: 'label', label: t.t === 'num' ? String(t.num) : t.v, line }]
      }
      case 'end': this.i++; return [{ k: 'end', line }]
      case 'stop': this.i++; return [{ k: 'noop', line }]
      case 'option': while (this.cur.t !== 'nl') this.i++; return [{ k: 'noop', line }]
      case 'debug':
        if (this.isAt(1, '.') && this.isAt(2, 'print')) {
          this.i += 3
          const items: PrintItem[] = []
          while (!this.eos()) {
            if (this.is(';') || this.is(',')) { items.push({ sep: this.cur.v as ';' | ',' }); this.i++; continue }
            const e = this.expr()
            const item: PrintItem = { e }
            if (this.is(';') || this.is(',')) { item.sep = this.cur.v as ';' | ','; this.i++ }
            items.push(item)
          }
          return [{ k: 'print', items, line }]
        }
        break
      case 'set': { this.i++; const target = this.postfix(); this.want('='); return [{ k: 'assign', set: true, target, value: this.expr(), line }] }
      case 'let': this.i++; break
      case 'call': {
        this.i++
        const t = this.postfix()
        if (t.k === 'call') return [{ k: 'call', target: t.target, args: t.args, explicit: true, line }]
        return [{ k: 'call', target: t, args: [], explicit: true, line }]
      }
      default: break
    }
    const target = this.postfix(true)
    if (this.eat('=')) return [{ k: 'assign', set: false, target, value: this.expr(), line }]
    if (this.eos()) {
      // Foo(1, 2) as a statement: VBA wants `Foo 1, 2` or `Call Foo(1, 2)` (one argument in brackets is an expression)
      if (target.k === 'call' && target.args.length > 1) throw this.err('Expected: =')
      if (target.k === 'call') return [{ k: 'call', target: target.target, args: target.args, explicit: false, line }]
      return [{ k: 'call', target, args: [], explicit: false, line }]
    }
    const args = this.args()
    return [{ k: 'call', target, args, explicit: false, line }]
  }
  ifStmt(line: number): Stmt {
    this.i++
    const cond = this.expr()
    this.want('then')
    if (!this.eos() || this.is(':')) {
      if (!this.atEol()) {
        // single-line If
        this.inSingleIf++
        const body: Stmt[] = []
        while (!this.atEol() && !this.is('else')) { if (this.eat(':')) continue; body.push(...this.stmt()) }
        let elseBody: Stmt[] | undefined
        if (this.eat('else')) { elseBody = []; while (!this.atEol()) { if (this.eat(':')) continue; elseBody.push(...this.stmt()) } }
        this.inSingleIf--
        return { k: 'if', branches: [{ cond, body }], elseBody, line }
      }
    }
    const branches = [{ cond, body: this.block(() => this.is('elseif') || this.is('else') || this.endOf('if'), 'if', line) }]
    let elseBody: Stmt[] | undefined
    for (;;) {
      if (this.eat('elseif')) { const c = this.expr(); this.want('then'); branches.push({ cond: c, body: this.block(() => this.is('elseif') || this.is('else') || this.endOf('if'), 'if', line) }); continue }
      if (this.eat('else')) { elseBody = this.block(() => this.endOf('if'), 'if', line); continue }
      break
    }
    this.want('end'); this.want('if')
    return { k: 'if', branches, elseBody, line }
  }
  params(): Param[] {
    const out: Param[] = []
    if (!this.eat('(')) return out
    if (this.eat(')')) return out
    do {
      const p: Param = { name: '', byVal: false, optional: false }
      for (;;) {
        if (this.eat('optional')) p.optional = true
        else if (this.eat('byval')) p.byVal = true
        else if (this.eat('byref')) p.byVal = false
        else if (this.eat('paramarray')) p.paramArray = true
        else break
      }
      p.name = this.id()
      if (this.eat('(')) { this.want(')'); p.isArray = true }
      p.type = this.typeRef()
      if (this.eat('=')) p.def = this.expr()
      out.push(p)
    } while (this.eat(','))
    this.want(')')
    return out
  }
  module(): Module {
    const mod: Module = { options: { explicit: false, base: 0, compareText: false }, decls: [], procs: [] }
    for (;;) {
      this.sep()
      if (this.i >= this.toks.length - 1) return mod
      const line = this.cur.line
      if (this.eat('option')) {
        if (this.eat('explicit')) mod.options.explicit = true
        else if (this.eat('base')) { mod.options.base = this.cur.num === 1 ? 1 : 0; this.i++ }
        else if (this.eat('compare')) { mod.options.compareText = this.eat('text'); if (!mod.options.compareText) this.i++ }
        else this.i++
        continue
      }
      let isPrivate = false, isStatic = false
      if (this.is('private') || this.is('public')) {
        const priv = this.is('private')
        if (!['sub', 'function', 'static'].some(w => this.isAt(1, w))) { this.i++; mod.decls.push(this.dim(priv ? 'private' : 'public', line)); continue }
        isPrivate = priv; this.i++
      }
      if (this.eat('static')) isStatic = true
      if (this.is('sub') || this.is('function')) {
        const kind = this.cur.v.toLowerCase() as 'sub' | 'function'
        this.i++
        const name = this.id()
        const params = this.params()
        const returnType = this.typeRef()
        const body = this.block(() => this.is('end') && this.isAt(1, kind), 'proc', line, kind)
        const endLine = this.cur.line
        this.i += 2
        mod.procs.push({ kind, name, params, returnType, isPrivate, isStatic, body, line, endLine } as Proc)
        continue
      }
      if (this.eat('dim')) { mod.decls.push(this.dim('dim', line)); continue }
      if (this.eat('const')) { mod.decls.push(this.constStmt(line)); continue }
      throw this.err('Invalid outside procedure')
    }
  }
}

export function parseModule(source: string): { module: Module } | { error: ParseError } {
  let p: P | undefined
  try {
    p = new P(lex(source))
    return { module: p.module() }
  } catch (e) {
    if (e && typeof e === 'object' && 'line' in e && 'message' in e) return { error: e as ParseError }
    // ponytail: an unexpected parser crash is reported as a syntax error at the current token
    return { error: { line: p?.cur.line ?? 1, message: 'Compile error: Syntax error' } }
  }
}
