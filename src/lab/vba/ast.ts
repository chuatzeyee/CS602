// AST of the VBA subset run by the lab's interpreter. The parser (parser.ts) produces it; the interpreter walks it.
// Names keep the case the learner typed; every lookup is case-insensitive. Every statement carries its 1-based line.

export type BinOp =
  | '^' | '*' | '/' | '\\' | 'mod' | '+' | '-' | '&'
  | '=' | '<>' | '<' | '>' | '<=' | '>=' | 'like' | 'is'
  | 'and' | 'or' | 'xor' | 'eqv' | 'imp'

export type Expr =
  | { k: 'num'; v: number; type: 'int' | 'long' | 'double' | 'single' | 'currency' }  // literal; type from its size or suffix (% & ! # @)
  | { k: 'str'; v: string }
  | { k: 'date'; v: number }                                // #1/2/2026# as an Excel serial (fraction = time)
  | { k: 'bool'; v: boolean }
  | { k: 'empty' }
  | { k: 'null' }
  | { k: 'nothing' }
  | { k: 'name'; name: string }                             // variable, constant, procedure or global
  | { k: 'member'; obj: Expr | null; name: string }         // obj.name; obj null = leading dot inside With
  | { k: 'call'; target: Expr; args: Arg[] }                // target(args): call, array index or default member, resolved at run time
  | { k: 'paren'; e: Expr }                                 // (e): forces evaluation, so a ByRef argument is passed by value
  | { k: 'unary'; op: '-' | '+' | 'not'; e: Expr }
  | { k: 'bin'; op: BinOp; l: Expr; r: Expr }
  | { k: 'new'; className: string }                         // New X: unsupported at run time
  | { k: 'missing' }                                        // omitted argument: f(a, , c)

export interface Arg {
  name?: string                                             // named argument: Paste:=xlPasteValues
  value: Expr
}

export interface TypeRef {
  name: string                                              // as written: 'Integer', 'range', 'Variant'
  fixedLen?: number                                         // String * 10
}

export interface Bound {
  lo?: Expr                                                 // omitted = Option Base
  hi: Expr
}

export interface VarDecl {
  name: string
  type?: TypeRef
  bounds?: Bound[]                                          // Dim a(1 To 5, 2): fixed array
  dynamicArray?: boolean                                    // Dim a()
  isNew?: boolean                                           // Dim c As New Collection
}

export type CaseTest =
  | { k: 'value'; e: Expr }
  | { k: 'range'; from: Expr; to: Expr }                    // Case 1 To 5
  | { k: 'is'; op: '=' | '<>' | '<' | '>' | '<=' | '>='; e: Expr }   // Case Is >= 10

export interface PrintItem {
  e?: Expr                                                  // absent: a bare separator
  sep?: ';' | ','                                           // separator after the item
}

interface At { line: number }

export type Stmt =
  | (At & { k: 'dim'; scope: 'dim' | 'static' | 'private' | 'public'; vars: VarDecl[] })
  | (At & { k: 'redim'; preserve: boolean; items: { name: string; bounds: Bound[]; type?: TypeRef }[] })
  | (At & { k: 'const'; items: { name: string; type?: TypeRef; value: Expr }[] })
  | (At & { k: 'assign'; set: boolean; target: Expr; value: Expr })           // [Let] x = e / Set x = e
  | (At & { k: 'call'; target: Expr; args: Arg[]; explicit: boolean })        // Call X(a) / X a, b / obj.M a / X
  | (At & { k: 'if'; branches: { cond: Expr; body: Stmt[] }[]; elseBody?: Stmt[] })  // block and single-line
  | (At & { k: 'select'; subject: Expr; cases: { line: number; tests: CaseTest[]; body: Stmt[] }[]; elseBody?: Stmt[] })
  | (At & { k: 'for'; counter: Expr; from: Expr; to: Expr; step?: Expr; body: Stmt[]; endLine?: number })  // endLine: Next
  | (At & { k: 'forEach'; item: Expr; group: Expr; body: Stmt[]; endLine?: number })
  | (At & { k: 'do'; pre?: { until: boolean; cond: Expr }; post?: { until: boolean; cond: Expr }; body: Stmt[]; endLine?: number })
  | (At & { k: 'while'; cond: Expr; body: Stmt[] })                           // While ... Wend
  | (At & { k: 'exit'; what: 'sub' | 'function' | 'for' | 'do' })
  | (At & { k: 'with'; obj: Expr; body: Stmt[] })
  | (At & { k: 'label'; name: string })                                       // name: or a line number
  | (At & { k: 'goto'; label: string })
  | (At & { k: 'onError'; mode: 'goto' | 'resumeNext' | 'goto0'; label?: string })
  | (At & { k: 'resume'; mode: 'same' | 'next' | 'label'; label?: string })
  | (At & { k: 'print'; items: PrintItem[] })                                 // Debug.Print a; b, c
  | (At & { k: 'end' })                                                       // End: stop the whole macro
  | (At & { k: 'noop' })                                                      // Stop, Option lines inside procedures, etc.

export interface Param {
  name: string
  byVal: boolean                                            // VBA default is ByRef
  optional: boolean
  def?: Expr
  type?: TypeRef
  isArray?: boolean                                         // x() As Double
  paramArray?: boolean
}

export interface Proc {
  kind: 'sub' | 'function'
  name: string
  params: Param[]
  returnType?: TypeRef
  isPrivate: boolean
  isStatic: boolean
  body: Stmt[]
  line: number                                              // the Sub/Function line
  endLine: number                                           // the End Sub/End Function line
}

export interface Module {
  options: { explicit: boolean; base: 0 | 1; compareText: boolean }
  decls: Stmt[]                                             // module-level Dim/Private/Public/Const
  procs: Proc[]
}

export interface ParseError {
  line: number
  message: string                                           // 'Compile error: Expected: End Sub'
}
