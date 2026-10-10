import { useId, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import type { LabSheet, ToolDialogProps } from '../types'
import { toRange, toRef } from '../refs'
import { absRange } from '../tools/advFilter'
import { applySort, BUILTIN_LISTS, looksLikeHeaders, sortColumns } from '../tools/sort'
import type { SortOrder } from '../tools/sort'
import Dialog from './Dialog'
import RefField, { useRefPicker } from './RefField'
import { normRef, refProblem } from './refUtil'
import { listBox, startRegion } from './toolRange'
import { btnGhost, btnPrimary, btnSecondary, input, label as labelCls } from './ui'

interface Level { id: number; column: string; order: SortOrder; list: string }
interface Remembered { range: string; headers: boolean; levels: Level[] }
const lastSetup = new WeakMap<LabSheet, Remembered>()
let nextId = 1

type Kind = 'number' | 'date' | 'text'
const ORDER_TEXT: Record<Kind, [string, string]> = {
  number: ['Smallest to Largest', 'Largest to Smallest'],
  date: ['Oldest to Newest', 'Newest to Oldest'],
  text: ['A to Z', 'Z to A'],
}
const DATE_FMT = /[dy]|m{3,}/i

export default function SortDialog({ sheet, selection, onClose, onDone }: ToolDialogProps) {
  const picker = useRefPicker(selection)
  const [start] = useState<Remembered>(() => {
    const prev = lastSetup.get(sheet)
    if (prev) return prev
    const region = startRegion(sheet, selection)
    const headers = region ? looksLikeHeaders(sheet.values(toRange({ ...region, r2: Math.min(region.r2, region.r1 + 20) }))) : true
    return { range: region ? absRange(region) : '', headers, levels: [] }
  })
  const [range, setRange] = useState(start.range)
  const [headers, setHeaders] = useState(start.headers)
  const version = sheet.version
  const area = useMemo(() => listBox(sheet, range), [sheet, range, version])   // one cell stands for its region
  const columns = useMemo(() => (area ? sortColumns(sheet, toRange(area), headers) : []), [sheet, area, headers, version])
  const [levels, setLevels] = useState<Level[]>(() => (start.levels.length ? start.levels : [{ id: nextId++, column: '', order: 'asc', list: '' }]))
  const [picked, setPicked] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const headersId = useId()

  // what the column holds decides Excel's order wording
  const kindOf = (column: string): Kind => {
    const b = area
    const j = columns.findIndex(c => c.key === column)
    if (!b || j < 0) return 'text'
    const first = headers ? b.r1 + 1 : b.r1
    if (first > b.r2) return 'text'
    const col = b.c1 + j
    const vals = sheet.values(toRange({ r1: first, c1: col, r2: Math.min(b.r2, first + 49), c2: col })).map(r => r[0] ?? null)
    const filled = vals.filter(v => v !== null && v !== '')
    const at = vals.findIndex(v => typeof v === 'number')
    if (at < 0 || filled.some(v => typeof v !== 'number')) return 'text'
    return DATE_FMT.test(sheet.fmt(toRef(first + at, col)) ?? '') ? 'date' : 'number'
  }

  const update = (i: number, patch: Partial<Level>) => setLevels(ls => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  const add = () => {
    setLevels(ls => [...ls, { id: nextId++, column: '', order: 'asc', list: '' }])
    setPicked(levels.length)
  }
  const copy = () => {
    const src = levels[picked]
    if (!src) return
    setLevels(ls => [...ls.slice(0, picked + 1), { ...src, id: nextId++ }, ...ls.slice(picked + 1)])
    setPicked(picked + 1)
  }
  const remove = () => {
    if (levels.length <= 1) return
    setLevels(ls => ls.filter((_, k) => k !== picked))
    setPicked(p => Math.max(0, p - 1))
  }
  const move = (d: -1 | 1) => {
    const j = picked + d
    if (j < 0 || j >= levels.length) return
    setLevels(ls => {
      const next = [...ls]
      ;[next[picked], next[j]] = [next[j], next[picked]]
      return next
    })
    setPicked(j)
  }

  const ok = () => {
    const e: Record<string, string> = {}
    const r = refProblem(range, { rows: sheet.rows, cols: sheet.cols })
    if (r) e.range = r
    levels.forEach((l, i) => {
      if (!l.column) e[`col${i}`] = 'Choose a column.'
      if (l.order === 'custom' && !l.list.trim()) e[`list${i}`] = 'Type the list entries in order, separated by commas.'
    })
    setErrors(e)
    if (Object.keys(e).length) return
    const setup = {
      range: normRef(range),
      headers,
      levels: levels.map(l => ({ column: l.column, order: l.order, ...(l.order === 'custom' ? { list: l.list } : {}) })),
    }
    const res = applySort(sheet, setup)
    if (!res.ok) {
      setErrors({ form: res.message })
      return
    }
    lastSetup.set(sheet, { range, headers, levels })
    const by = levels.map(l => columns.find(c => c.key === l.column)?.label ?? l.column).join(', then ')
    onDone(`Sorted ${area ? toRange(area) : normRef(range)} by ${by}`)
    onClose()
  }

  return (
    <Dialog
      title="Sort"
      onClose={onClose}
      width="sm:w-[560px]"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={ok}>OK</button>
        </>
      }
    >
      <div onFocusCapture={picker.onFocusCapture} className="space-y-3">
        <RefField label="Sort range:" value={range} onChange={setRange} picker={picker} pickKey="range" error={errors.range} placeholder="e.g. $A$8:$K$68" />
        {!columns.length && !errors.range && <p className="text-xs text-ink-muted">Select a cell inside your list (or type its range) to sort it by its columns.</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={btnSecondary} onClick={add}><Plus size={13} /> Add Level</button>
          <button type="button" className={btnSecondary} onClick={remove} disabled={levels.length <= 1}><Trash2 size={13} /> Delete Level</button>
          <button type="button" className={btnSecondary} onClick={copy}><Copy size={13} /> Copy Level</button>
          <button type="button" className={btnGhost} onClick={() => move(-1)} disabled={picked === 0} aria-label="Move level up" title="Move up"><ArrowUp size={14} /></button>
          <button type="button" className={btnGhost} onClick={() => move(1)} disabled={picked >= levels.length - 1} aria-label="Move level down" title="Move down"><ArrowDown size={14} /></button>
          <label htmlFor={headersId} className="ml-auto flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input id={headersId} type="checkbox" checked={headers} onChange={e => setHeaders(e.target.checked)} className="accent-glow" />
            My data has headers
          </label>
        </div>

        <div className="space-y-2" role="list" aria-label="Sort levels">
          {levels.map((l, i) => {
            const kind = l.column ? kindOf(l.column) : 'text'
            const [up, down] = ORDER_TEXT[kind]
            return (
              <div
                key={l.id}
                role="listitem"
                onFocusCapture={() => setPicked(i)}
                onClick={() => setPicked(i)}
                className={`rounded-lg border p-2.5 space-y-2 ${picked === i ? 'border-glow/40 bg-glow-dim/20' : 'border-edge bg-surface'}`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-[5.5rem_1fr_7rem_1fr] gap-2 sm:items-center">
                  <span className="text-xs font-medium text-ink-secondary">{i === 0 ? 'Sort by' : 'Then by'}</span>
                  <select
                    aria-label={`${i === 0 ? 'Sort by' : 'Then by'} column`}
                    value={l.column}
                    onChange={e => update(i, { column: e.target.value })}
                    className={`${input} ${errors[`col${i}`] ? 'border-wrong/60' : ''}`}
                  >
                    <option value="">(choose a column)</option>
                    {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <select aria-label="Sort On" value="values" disabled className={`${input} text-ink-muted`} title="Sorting by colour or icon is not available in the lab">
                    <option value="values">Cell Values</option>
                  </select>
                  <select aria-label="Order" value={l.order} onChange={e => update(i, { order: e.target.value as SortOrder })} className={input}>
                    <option value="asc">{up}</option>
                    <option value="desc">{down}</option>
                    <option value="custom">Custom List…</option>
                  </select>
                </div>
                {errors[`col${i}`] && <p className="text-[11px] text-wrong">{errors[`col${i}`]}</p>}
                {l.order === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-2">
                    <div>
                      <span className={labelCls}>Custom lists:</span>
                      <select
                        aria-label="Built-in custom list"
                        value={Object.entries(BUILTIN_LISTS).find(([, v]) => v.join(', ') === l.list)?.[0] ?? ''}
                        onChange={e => update(i, { list: e.target.value ? BUILTIN_LISTS[e.target.value].join(', ') : '' })}
                        className={input}
                      >
                        <option value="">NEW LIST</option>
                        {Object.entries(BUILTIN_LISTS).map(([name, v]) => <option key={name} value={name}>{v.slice(0, 3).join(', ')}, …</option>)}
                      </select>
                    </div>
                    <div>
                      <span className={labelCls}>List entries (in order):</span>
                      <input
                        aria-label="Custom list entries"
                        value={l.list}
                        onChange={e => update(i, { list: e.target.value })}
                        placeholder="Low, Medium, High"
                        className={`${input} ${errors[`list${i}`] ? 'border-wrong/60' : ''}`}
                      />
                      {errors[`list${i}`] && <p className="text-[11px] text-wrong mt-1">{errors[`list${i}`]}</p>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {errors.form && <p role="alert" className="text-xs text-wrong">{errors.form}</p>}
        <p className="text-[11px] text-ink-muted leading-relaxed">
          Sort On is Cell Values only: sorting by cell colour, font colour or icon is not available in the lab.
          Blank cells always go last. Formulas move with their row and their relative references follow.
        </p>
      </div>
    </Dialog>
  )
}
