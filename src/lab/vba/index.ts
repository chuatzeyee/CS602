// The lab's public VBA API (CONTRACTS.md): run a macro against a LabSheet, call a Function, list procedures.
// Every entry point catches everything: a learner's macro can never crash the page.
import { createLabSheet } from '../sheet'
import type { CellValue, LabSheet, VbaOutput, VbaRunResult } from '../types'
import type { Module, Proc } from './ast'
import { runModule } from './interpreterCore'
import { HostStop } from './interpreterTypes'
import { MAX_MESSAGES, createLabHost, type LabHost, type LabHostOptions } from './labHost'
import { excelScope } from './objects'
import { parseModule } from './parser'
import { fromCell, toCell, type Val } from './runtime'

export interface RunVbaOptions {
  activeCell?: string
  selection?: string
  inputs?: string[]                                     // scripted InputBox answers, in order
  msgBoxReplies?: number[]                              // scripted MsgBox return values (vbYes = 6, vbNo = 7), in order
  maxSteps?: number
  maxMs?: number                                        // running-time budget, prompts excluded (default 5 s; 0 = none)
  started?: number                                      // performance.now() when that budget started (a Check shares one)
  prompt?: (text: string, def: string) => string | null // asked when `inputs` run out (the panel passes window.prompt)
  clock?: number                                        // Excel serial for Now; default: a fixed Monday 09:00
  seed?: number                                         // Rnd seed
}

export interface ProcInfo {
  name: string
  kind: 'sub' | 'function'
  params?: number                                       // parameters without a default (0 = runnable as a macro)
  line?: number                                         // the Sub/Function line (1-based)
  endLine?: number                                      // the End Sub/End Function line
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

type Parsed = { ok: true; module: Module } | { ok: false; line: number; message: string }

function parse(source: string): Parsed {
  try {
    const r = parseModule(typeof source === 'string' ? source : '')
    if ('error' in r) {
      const text = r.error.message.startsWith('Compile error') ? r.error.message : `Compile error: ${r.error.message}`
      return { ok: false, line: r.error.line, message: text }
    }
    return { ok: true, module: r.module }
  } catch (e) {
    return { ok: false, line: 0, message: `Compile error: ${message(e)}` }
  }
}

// the module's syntax error, if it has one (nothing can run until it is fixed)
export function syntaxError(source: string): { line: number; message: string } | null {
  const r = parse(source)
  return r.ok ? null : { line: r.line, message: r.message }
}

const required = (p: Proc): number => p.params.filter(x => !x.optional && !x.paramArray).length
const findProc = (mod: Module, name: string): Proc | undefined =>
  mod.procs.find(p => p.name.toLowerCase() === name.trim().toLowerCase())

export const MAX_MS = 5000
// a macro in a loop can print millions of lines: keep the last MAX_MESSAGES (labHost.ts), each cut at MAX_LINE characters
export const MAX_LINE = 5000
// InputBox prompts per run, and Cancels in a row, before the run stops: the lab has no Ctrl+Break for a prompt loop
export const MAX_PROMPTS = 30
export const MAX_CANCELS = 3

/** a run's result; `omitted` counts output lines dropped from the start (only the last MAX_MESSAGES are kept) */
export interface VbaRunOutcome extends VbaRunResult {
  omitted?: number
}

interface OutputLog { lines: VbaOutput[]; dropped: number }

function log(out: OutputLog, line: VbaOutput): void {
  out.lines.push(line.text.length > MAX_LINE ? { ...line, text: `${line.text.slice(0, MAX_LINE)}…` } : line)
  if (out.lines.length >= 2 * MAX_MESSAGES) out.dropped += out.lines.splice(0, out.lines.length - MAX_MESSAGES).length
}

// a host that also records what kind of output each message was (MsgBox, Debug.Print, InputBox) and how long the
// user took to answer prompts (not counted against the time budget)
function tagged(host: LabHost, output: OutputLog, waited: { ms: number }): LabHost {
  const h: LabHost = Object.create(host) as LabHost
  h.msgBox = (prompt, buttons, title) => {
    log(output, { kind: 'msgbox', text: prompt })
    return host.msgBox(prompt, buttons, title)
  }
  h.print = text => {
    log(output, { kind: 'print', text })
    host.print(text)
  }
  h.inputBox = (prompt, title, def) => {
    const t0 = performance.now()
    const answer = host.inputBox(prompt, title, def)
    waited.ms += performance.now() - t0
    log(output, { kind: 'input', text: prompt, answer: answer ?? undefined })
    return answer
  }
  return h
}

// the learner's prompt callback, stopped after MAX_PROMPTS prompts or MAX_CANCELS Cancels in a row
function limited(prompt: (text: string, def: string) => string | null): (text: string, def: string) => string | null {
  let asked = 0
  let cancels = 0
  return (text, def) => {
    if (asked >= MAX_PROMPTS) throw new HostStop(`Macro stopped after ${MAX_PROMPTS} InputBox prompts: possible infinite loop`)
    asked += 1
    const answer = prompt(text, def)
    cancels = answer === null ? cancels + 1 : 0
    if (cancels >= MAX_CANCELS) throw new HostStop(`Macro stopped: InputBox was cancelled ${MAX_CANCELS} times in a row`)
    return answer
  }
}

const failed = (line: number, text: string, steps = 0): VbaRunOutcome =>
  ({ ok: false, error: { line, message: text }, messages: [], output: [], steps })

// run `entry` (a Sub, or a Function used as a macro) against `sheet`. Changes made before a run-time error stay,
// like Excel; the whole run is one undo step.
export function runVba(sheet: LabSheet, source: string, entry: string, opts: RunVbaOptions = {}): VbaRunOutcome {
  const parsed = parse(source)
  if (!parsed.ok) return failed(parsed.line, parsed.message)
  const proc = findProc(parsed.module, entry)
  if (!proc) return failed(0, `There is no Sub called ${entry || '(none)'} in the module.`)
  if (required(proc) > 0) {
    return failed(proc.line, `${proc.name} needs arguments, so it cannot run as a macro: run a Sub without parameters that calls it.`)
  }
  const hostOpts: LabHostOptions = {
    activeCell: opts.activeCell, selection: opts.selection, inputs: opts.inputs, prompt: opts.prompt && limited(opts.prompt),
    clock: opts.clock, seed: opts.seed, msgBoxReplies: opts.msgBoxReplies,
  }
  let host: LabHost
  try {
    host = createLabHost(sheet, hostOpts)
  } catch (e) {
    return failed(0, `The macro could not start: ${message(e)}`)
  }
  const output: OutputLog = { lines: [], dropped: 0 }
  const waited = { ms: 0 }
  const h = tagged(host, output, waited)
  let result: { ok: boolean; error?: { line: number; message: string }; steps: number }
  try {
    result = runModule(parsed.module, proc.name, [], {
      host: h, globals: excelScope(h), maxSteps: opts.maxSteps, maxMs: opts.maxMs ?? MAX_MS, started: opts.started, paused: () => waited.ms,
    })
  } catch (e) {
    result = { ok: false, error: { line: 0, message: `Internal error: ${message(e)}` }, steps: 0 }
  }
  let applied: { ok: boolean; message?: string }
  try {
    applied = host.finish()
  } catch (e) {
    applied = { ok: false, message: message(e) }
  }
  let sel: { range: string; active: string } | undefined
  try {
    sel = host.finalSelection()
  } catch {
    sel = undefined
  }
  const lines = output.lines.slice(-MAX_MESSAGES)
  const omitted = output.dropped + output.lines.length - lines.length
  const out: VbaRunOutcome = {
    ok: result.ok && applied.ok,
    messages: host.messages.slice(-MAX_MESSAGES),
    output: lines,
    steps: result.steps,
    ...(sel ? { activeCell: sel.active, selection: sel.range } : {}),
    ...(omitted > 0 ? { omitted } : {}),
  }
  if (host.styles.size) out.styles = Object.fromEntries(host.styles)
  if (result.error) out.error = result.error
  else if (!applied.ok) out.error = { line: 0, message: `The macro's changes could not be written: ${applied.message ?? 'unknown problem'}` }
  return out
}

let scratch: LabSheet | undefined
const scratchSheet = (): LabSheet => (scratch ??= createLabSheet({ rows: 20, cols: 10, cells: {} }))

// call Function `name` with cell values as arguments; on `sheet` when given (reads see its cells), else on a blank
// scratch sheet. Whatever the function writes is put back afterwards.
export function callFunctionOn(
  sheet: LabSheet | undefined, source: string, name: string, args: CellValue[], opts: { started?: number } = {},
): { ok: true; value: CellValue } | { ok: false; error: string; line?: number } {
  const parsed = parse(source)
  if (!parsed.ok) return { ok: false, error: parsed.message, line: parsed.line }
  const proc = findProc(parsed.module, name)
  if (!proc) return { ok: false, error: `There is no Function called ${name} in the module.` }
  if (proc.kind !== 'function') return { ok: false, error: `${proc.name} is a Sub, so it returns no value: make it a Function.`, line: proc.line }
  let host: LabHost
  try {
    host = createLabHost(sheet ?? scratchSheet())
  } catch (e) {
    return { ok: false, error: `The function could not start: ${message(e)}` }
  }
  try {
    const r = runModule(parsed.module, proc.name, args.map(fromCell), {
      host, globals: excelScope(host), maxSteps: 2_000_000, maxMs: MAX_MS, started: opts.started,
    })
    if (!r.ok) return { ok: false, error: r.error?.message ?? 'The function failed.', line: r.error?.line }
    return valueOf(r.value)
  } catch (e) {
    return { ok: false, error: `Internal error: ${message(e)}` }
  } finally {
    try {
      host.discard()
    } catch {
      // nothing was written, or the sheet is gone
    }
  }
}

function valueOf(v: Val | undefined): { ok: true; value: CellValue } | { ok: false; error: string } {
  if (!v) return { ok: true, value: null }
  if (v.t === 'arr') return { ok: false, error: 'The function returned an array, not a single value.' }
  if (v.t === 'obj') return { ok: false, error: 'The function returned an object, not a value.' }
  try {
    return { ok: true, value: toCell(v) }
  } catch (e) {
    return { ok: false, error: message(e) }
  }
}

export function callVbaFunction(
  source: string, name: string, args: CellValue[],
): { ok: true; value: CellValue } | { ok: false; error: string } {
  const r = callFunctionOn(undefined, source, name, args)
  return r.ok ? r : { ok: false, error: r.error }
}

// every procedure in the module, in order; falls back to a line scan when the module does not parse
export function listProcedures(source: string): ProcInfo[] {
  const parsed = parse(source)
  if (parsed.ok) {
    return parsed.module.procs.map(p => ({ name: p.name, kind: p.kind, params: required(p), line: p.line, endLine: p.endLine }))
  }
  const out: ProcInfo[] = []
  String(source ?? '').split(/\r?\n/).forEach((text, i) => {
    const last = out[out.length - 1]
    if (last && last.endLine === undefined && /^\s*End\s+(Sub|Function)\b/i.test(text)) last.endLine = i + 1
    const m = /^\s*(?:(?:Public|Private|Friend)\s+)?(?:Static\s+)?(Sub|Function)\s+([A-Za-z_]\w*)\s*(\(([^)]*)\))?/i.exec(text)
    if (!m) return
    if (last && last.endLine === undefined) last.endLine = i
    const params = (m[4] ?? '').split(',').map(s => s.trim()).filter(s => s && !/^(Optional|ParamArray)\b/i.test(s)).length
    out.push({ name: m[2], kind: m[1].toLowerCase() === 'sub' ? 'sub' : 'function', params, line: i + 1 })
  })
  return out
}
