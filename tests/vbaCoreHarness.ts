// Shared harness for the vba-core interpreter tests: parse VBA source, run it against a fake host.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Module, ParseError } from '../src/lab/vba/ast.ts'
import { parseModule } from '../src/lab/vba/parser.ts'
import { runModule, type RunResult } from '../src/lab/vba/interpreterCore.ts'
import type { CellValue } from '../src/lab/types.ts'
import type { GlobalScope, Val, VbaHost } from '../src/lab/vba/runtime.ts'

type Parse = (src: string) => { module: Module } | { error: ParseError }
export const parse: Parse = parseModule
export const vtest = test

export interface Fake {
  host: VbaHost
  cells: Map<string, CellValue>
  printed: string[]
  prompts: string[]
}

export function fakeHost(inputs: (string | null)[] = [], replies: number[] = []): Fake {
  const cells = new Map<string, CellValue>()
  const printed: string[] = []
  const prompts: string[] = []
  const key = (r: number, c: number) => `${r},${c}`
  const host: VbaHost = {
    sheetName: 'Sheet1', rows: 100, cols: 26,
    value: (r, c) => cells.get(key(r, c)) ?? null,
    formula: (r, c) => String(cells.get(key(r, c)) ?? ''),
    setFormula: (r, c, t) => { cells.set(key(r, c), t) },
    setValue: (r, c, v) => { if (v === null) cells.delete(key(r, c)); else cells.set(key(r, c), v) },
    numberFormat: () => 'General', setNumberFormat: () => undefined, style: () => ({}), setStyle: () => undefined,
    clear: () => undefined, recalc: () => undefined, evaluate: () => null,
    selection: () => ({ range: 'A1', active: 'A1' }), select: () => undefined,
    msgBox: p => { prompts.push(p); return replies.shift() ?? 1 },
    inputBox: p => { prompts.push(p); return inputs.length ? inputs.shift()! : null },
    print: t => { printed.push(t) },
    now: () => 46297.5,
    random: () => 0.25,
  }
  return { host, cells, printed, prompts }
}

export interface RunOpts { inputs?: (string | null)[]; replies?: number[]; args?: Val[]; maxSteps?: number; globals?: GlobalScope }

export function run(src: string, entry = 'Main', o: RunOpts = {}): RunResult & Fake {
  const parsed = parse(src)
  if ('error' in parsed) throw new Error(`parse error line ${parsed.error.line}: ${parsed.error.message}`)
  const fake = fakeHost(o.inputs, o.replies)
  const res = runModule(parsed.module, entry, o.args ?? [], { host: fake.host, maxSteps: o.maxSteps, globals: o.globals })
  return { ...res, ...fake }
}

// run Main and return its Debug.Print lines (fails on a run error)
export function prints(src: string, o: RunOpts = {}): string[] {
  const r = run(src, 'Main', o)
  assert.equal(r.error?.message, undefined, `line ${r.error?.line}: ${r.error?.message}`)
  return r.printed
}

export const main = (body: string, head = ''): string => `${head}\nSub Main()\n${body}\nEnd Sub\n`

