// Learner progress in localStorage. No engine imports: safe for the catalogue, Exam and Home pages.
import type { LearnerState } from './types'

export interface ExerciseProgress {
  state: LearnerState
  solved: string[]            // task ids passed at the last Check
  total: number               // task count when saved
  best: number                // best score 0-1
  updated: number             // epoch ms
}

export interface MockProgress {
  states: Record<string, LearnerState>   // question id -> state
  startedAt?: number
  submittedAt?: number
  best?: { got: number; max: number }
}

const EX = 'cs602-lab:'
const MOCK = 'cs602-mock:'

function load(key: string): unknown {
  try {
    const s = localStorage.getItem(key)
    return s ? (JSON.parse(s) as unknown) : undefined
  } catch {
    return undefined   // storage disabled or corrupt entry: treat as no progress
  }
}

// false when the browser refused (storage full, or blocked in private mode): the player warns the learner
function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // storage disabled: nothing to remove
  }
}

// stored entries are external data (older versions, hand edits, other sites on the same github.io origin): keep only
// well-formed parts, so a bad entry can neither crash the player nor cost the learner the rest of their work
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

function entriesOf<T>(v: unknown, keep: (x: unknown) => x is T): Record<string, T> | undefined {
  if (!isObj(v)) return undefined
  const out: Record<string, T> = {}
  for (const [k, x] of Object.entries(v)) if (keep(x)) out[k] = x
  return Object.keys(out).length ? out : undefined
}
const isString = (x: unknown): x is string => typeof x === 'string'
const isBoolean = (x: unknown): x is boolean => typeof x === 'boolean'
const optionalRef = (x: unknown): boolean => x === undefined || typeof x === 'string'
const isTable = (x: unknown): x is NonNullable<LearnerState['dataTables']>[number] =>
  isObj(x) && typeof x.range === 'string' && optionalRef(x.rowInput) && optionalRef(x.colInput)

/** a stored learner state with only its well-formed parts; undefined unless edits is a map of strings */
export function cleanState(v: unknown): LearnerState | undefined {
  if (!isObj(v) || !isObj(v.edits) || !Object.values(v.edits).every(isString)) return undefined
  const out: LearnerState = { edits: v.edits as Record<string, string> }
  const fmts = entriesOf(v.fmts, isString)
  const vba = entriesOf(v.vba, isString)
  const notes = entriesOf(v.notes, isString)
  const selfMarks = entriesOf(v.selfMarks, isBoolean)
  const tables = Array.isArray(v.dataTables) ? v.dataTables.filter(isTable) : []
  const hidden = Array.isArray(v.hiddenRows) ? v.hiddenRows.filter((r): r is number => Number.isInteger(r)) : []
  if (fmts) out.fmts = fmts
  if (tables.length) out.dataTables = tables
  if (hidden.length) out.hiddenRows = hidden
  if (vba) out.vba = vba
  if (notes) out.notes = notes
  if (selfMarks) out.selfMarks = selfMarks
  if (isBoolean(v.iterative)) out.iterative = v.iterative
  return out
}

function exerciseProgress(v: unknown): ExerciseProgress | undefined {
  const state = isObj(v) ? cleanState(v.state) : undefined
  if (!isObj(v) || !state) return undefined
  return {
    state,
    solved: Array.isArray(v.solved) ? v.solved.filter((x): x is string => typeof x === 'string') : [],
    total: num(v.total) ?? 0,
    best: num(v.best) ?? 0,
    updated: num(v.updated) ?? 0,
  }
}

function mockProgress(v: unknown): MockProgress | undefined {
  if (!isObj(v)) return undefined
  const states: Record<string, LearnerState> = {}
  if (isObj(v.states)) {
    for (const [k, s] of Object.entries(v.states)) {
      const state = cleanState(s)
      if (state) states[k] = state
    }
  }
  const got = isObj(v.best) ? num(v.best.got) : undefined
  const max = isObj(v.best) ? num(v.best.max) : undefined
  return {
    states,
    startedAt: num(v.startedAt),
    submittedAt: num(v.submittedAt),
    ...(got !== undefined && max !== undefined ? { best: { got, max } } : {}),
  }
}

export const getExerciseProgress = (id: string): ExerciseProgress | undefined => exerciseProgress(load(EX + id))
export const saveExerciseProgress = (id: string, p: ExerciseProgress): boolean => save(EX + id, p)
export const clearExerciseProgress = (id: string): void => remove(EX + id)

export const getMockProgress = (id: string): MockProgress | undefined => mockProgress(load(MOCK + id))
export const saveMockProgress = (id: string, p: MockProgress): boolean => save(MOCK + id, p)
export const clearMockProgress = (id: string): void => remove(MOCK + id)
export const getMockBest = (id: string): { got: number; max: number } | undefined => getMockProgress(id)?.best
