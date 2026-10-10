// Shared harness for the vba-semantics tests: run a small program on a fresh LabSheet through the public runVba API.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLabSheet } from '../src/lab/sheet'
import { runVba, type RunVbaOptions } from '../src/lab/vba/index'
import type { CellSpec, LabSheet, VbaRunResult } from '../src/lab/types'

export type Expect = string[] | { err: RegExp; line?: number } | { compile: RegExp; line?: number }
export type Case = [name: string, src: string, want: Expect]

export interface Ran { r: VbaRunResult; sheet: LabSheet; out: string[] }
export interface Opts extends RunVbaOptions { cells?: Record<string, CellSpec>; entry?: string; size?: [number, number] }

export const L = (...lines: string[]): string => lines.join('\n')
const isModule = (src: string): boolean => /^\s*(Public\s+|Private\s+)?(Sub|Function)\s/im.test(src)
export const moduleOf = (src: string): string => (isModule(src) ? `${src}\n` : `Sub Main()\n${src}\nEnd Sub\n`)

export function vba(src: string, o: Opts = {}): Ran {
  const sheet = createLabSheet({ rows: o.size?.[0] ?? 30, cols: o.size?.[1] ?? 8, cells: o.cells ?? {} })
  const r = runVba(sheet, moduleOf(src), o.entry ?? 'Main', o)
  const out = (r.output ?? []).filter(x => x.kind === 'print').map(x => x.text.trimEnd())
  return { r, sheet, out }
}

export function check(src: string, want: Expect, o: Opts = {}): Ran {
  const ran = vba(src, o)
  const { r, out } = ran
  if (Array.isArray(want)) {
    assert.equal(r.error?.message, undefined, `line ${r.error?.line}: ${r.error?.message}; printed ${JSON.stringify(out)}`)
    assert.deepEqual(out, want)
    return ran
  }
  const pattern = 'err' in want ? want.err : want.compile
  assert.equal(r.ok, false, `expected an error, printed ${JSON.stringify(out)}`)
  assert.match(r.error?.message ?? '', pattern)
  if ('compile' in want) assert.match(r.error?.message ?? '', /^Compile error/)
  else assert.match(r.error?.message ?? '', /^Run-time error/)
  if (want.line !== undefined) assert.equal(r.error?.line, want.line, r.error?.message)
  return ran
}

export const runCases = (cases: Case[]): void => {
  for (const [name, src, want] of cases) test(name, () => { check(src, want) })
}

export const E6 = /'6': Overflow/
export const E9 = /'9': Subscript out of range/
export const E13 = /'13': Type mismatch/
export const E1004 = /'1004'/

// cells from a compact map: numbers and strings are constants, strings starting with '=' are formulas
export const cellsOf = (m: Record<string, number | string | boolean>): Record<string, CellSpec> =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, typeof v === 'string' && v.startsWith('=') ? { f: v } : { v }]))

// the value in a cell, as the checker sees it
export const val = (sheet: LabSheet, ref: string): unknown => sheet.read(ref).value
