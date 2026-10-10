import { useId, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import type { CellValue, LabSheet, PivotAgg, PivotConfig, ToolDialogProps } from '../types'
import { parseRef, toRef } from '../refs'
import { formatNumber } from '../engine/format'
import { absRange, boxIn, valueKey } from '../tools/advFilter'
import { AGG_LABEL, applyPivot, itemLabel, pivotArea, pivotConflict, pivotFields, SHOW_LABEL } from '../tools/pivot'
import type { PivotField, PivotShow } from '../tools/pivot'
import Dialog from './Dialog'
import RefField, { useRefPicker } from './RefField'
import { firstCell, normRef, refProblem } from './refUtil'
import { startRegion } from './toolRange'
import { btnGhost, btnPrimary, btnSecondary, input } from './ui'

type Area = 'filters' | 'columns' | 'rows' | 'values'
interface ValueField { field: string; agg: PivotAgg; show: PivotShow }
interface Layout { filters: { field: string; include: CellValue[] }[]; columns: string[]; rows: string[]; values: ValueField[] }
interface Remembered { source: string; target: string; layout: Layout }
const lastSetup = new WeakMap<LabSheet, Remembered>()

const EMPTY: Layout = { filters: [], columns: [], rows: [], values: [] }
// shown until the source is usable; what is wrong with it is reported on Create, under Table/Range
const FIELDS_HINT = 'Select a cell inside your list (or type its range in Table/Range) and its column headers appear here as fields.'
const AREA_TITLE: Record<Area, string> = { filters: 'Filters', columns: 'Columns', rows: 'Rows', values: 'Σ Values' }
const AREAS: Area[] = ['filters', 'columns', 'rows', 'values']

function defaultTarget(sheet: LabSheet, source: string): string {
  const b = boxIn(sheet, source, 'range')
  if (typeof b === 'string') return ''
  if (b.c2 + 2 < sheet.cols) return `$${toRef(0, b.c2 + 2).replace(/\d+$/, '')}$${b.r1 + 1}`
  return b.r2 + 3 < sheet.rows ? `$${toRef(0, b.c1).replace(/\d+$/, '')}$${b.r2 + 4}` : ''
}

const has = (l: Layout, f: string) =>
  l.rows.includes(f) || l.columns.includes(f) || l.filters.some(x => x.field === f) || l.values.some(v => v.field === f)

function without(l: Layout, area: Area, index: number): Layout {
  if (area === 'filters') return { ...l, filters: l.filters.filter((_, i) => i !== index) }
  if (area === 'values') return { ...l, values: l.values.filter((_, i) => i !== index) }
  return { ...l, [area]: l[area].filter((_, i) => i !== index) }
}

// Rows, Columns and Filters hold a field once between them; Values may repeat a field
function withField(l: Layout, area: Area, field: string, numeric: boolean): Layout {
  if (area === 'values') return { ...l, values: [...l.values, { field, agg: numeric ? 'sum' : 'count', show: 'value' }] }
  const base: Layout = { ...l, rows: l.rows.filter(f => f !== field), columns: l.columns.filter(f => f !== field), filters: l.filters.filter(f => f.field !== field) }
  if (area === 'filters') return { ...base, filters: [...base.filters, { field, include: [] }] }
  return { ...base, [area]: [...base[area], field] }
}

// "PivotTable created at T3 (report filter above it at T1)": the report filters (one row each, then a blank row) go
// above the target, and a target too near the top moves the table body down until they fit (pivotArea)
export function pivotCreatedText(target: string, filters: number): string {
  const { row, col } = parseRef(target)
  const pageRows = filters > 0 ? filters + 1 : 0
  const top = pivotArea({ r1: row, c1: col }, { cells: [], pageRows }).r1
  const body = `PivotTable created at ${toRef(top + pageRows, col)}`
  if (filters === 0) return body
  const where = filters === 1 ? toRef(top, col) : `${toRef(top, col)}:${toRef(top + filters - 1, col)}`
  return `${body} (report filter${filters === 1 ? '' : 's'} above it at ${where})`
}

function moved<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export default function PivotDialog({ sheet, selection, task, onClose, onDone }: ToolDialogProps) {
  const picker = useRefPicker(selection)
  const [start] = useState<Remembered>(() => {
    const prev = lastSetup.get(sheet)
    if (prev) return prev
    const region = startRegion(sheet, selection)
    const source = region ? absRange(region) : ''
    const fromTask = task?.kind === 'tool' && task.tool === 'pivot' && task.cells ? `$${firstCell(task.cells).replace(/(\d+)$/, '$$$1')}` : ''
    return { source, target: fromTask || defaultTarget(sheet, normRef(source)), layout: EMPTY }
  })
  const [source, setSource] = useState(start.source)
  const [target, setTarget] = useState(start.target)
  const [layout, setLayout] = useState<Layout>(start.layout)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [created, setCreated] = useState<string | null>(null)
  const [replace, setReplace] = useState<string | null>(null)
  const ids = { fields: useId() }
  const version = sheet.version
  const fields = useMemo(() => (refProblem(source, { rows: sheet.rows, cols: sheet.cols }) ? 'Enter the table or range to analyse.' : pivotFields(sheet, normRef(source))), [sheet, source, version])
  const dropError = (key: string) => setErrors(e => (key in e ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e))
  const list: PivotField[] = typeof fields === 'string' ? [] : fields
  const info = (name: string) => list.find(f => f.name.toLowerCase() === name.toLowerCase())

  const toggle = (f: PivotField, on: boolean) => {
    setCreated(null)
    dropError('form')
    if (on) setLayout(l => withField(l, f.numeric ? 'values' : 'rows', f.name, f.numeric))
    else setLayout(l => ({ rows: l.rows.filter(x => x !== f.name), columns: l.columns.filter(x => x !== f.name), filters: l.filters.filter(x => x.field !== f.name), values: l.values.filter(v => v.field !== f.name) }))
  }
  const change = (next: (l: Layout) => Layout) => {
    setCreated(null)
    dropError('form')
    setReplace(null)
    setLayout(next)
  }

  const create = (confirmed = false) => {
    const e: Record<string, string> = {}
    const s = refProblem(source, { rows: sheet.rows, cols: sheet.cols })
    if (s) e.source = s
    const t = refProblem(target, { rows: sheet.rows, cols: sheet.cols })
    if (t) e.target = t
    if (!s && typeof fields === 'string') e.source = fields
    if (!layout.rows.length && !layout.columns.length && !layout.values.length) e.form = 'Tick fields or add them to Rows, Columns or Values.'
    setErrors(e)
    if (Object.keys(e).length) return
    const config: PivotConfig = {
      rows: layout.rows,
      columns: layout.columns,
      values: layout.values.map(v => ({ field: v.field, agg: v.agg, ...(v.show !== 'value' ? { show: v.show } : {}) })),
      filters: layout.filters,
    }
    const at = firstCell(normRef(target))
    const setup = { source: normRef(source), target: at, config }
    const busy = confirmed ? null : pivotConflict(sheet, setup)
    if (busy) {
      setReplace(busy)
      return
    }
    setReplace(null)
    const res = applyPivot(sheet, setup)
    if (!res.ok) {
      setErrors({ form: res.message })
      return
    }
    lastSetup.set(sheet, { source, target, layout })
    const text = pivotCreatedText(at, config.filters.length)
    setCreated(`${text}.`)
    onDone(text)
  }

  const row = (key: string, label: ReactNode, area: Area, i: number, count: number, extra?: ReactNode) => (
    <li key={key} className="bg-surface border border-edge rounded-md px-2 py-1.5 space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="flex-1 min-w-0 truncate text-xs font-medium text-ink">{label}</span>
        {area !== 'filters' && (
          <>
            <button type="button" className={`${btnGhost} !px-1 !py-0.5`} disabled={i === 0} onClick={() => change(l => reorder(l, area, i, -1))} aria-label={`Move ${String(label)} up`}><ArrowUp size={12} /></button>
            <button type="button" className={`${btnGhost} !px-1 !py-0.5`} disabled={i === count - 1} onClick={() => change(l => reorder(l, area, i, 1))} aria-label={`Move ${String(label)} down`}><ArrowDown size={12} /></button>
          </>
        )}
        {area !== 'values' && (
          <select
            aria-label={`Move ${String(label)} to another area`}
            value={area}
            onChange={e => {
              const to = e.target.value as Area
              const name = area === 'filters' ? layout.filters[i].field : layout[area as 'rows' | 'columns'][i]
              change(l => withField(without(l, area, i), to, name, info(name)?.numeric ?? false))
            }}
            className="bg-surface border border-edge rounded px-1 py-0.5 text-[11px] text-ink-secondary"
          >
            {AREAS.filter(a => a !== 'values').map(a => <option key={a} value={a}>{AREA_TITLE[a]}</option>)}
          </select>
        )}
        <button type="button" className={`${btnGhost} !px-1 !py-0.5`} onClick={() => change(l => without(l, area, i))} aria-label={`Remove ${String(label)}`}><X size={12} /></button>
      </div>
      {extra}
    </li>
  )

  const areaBox = (area: Area, items: ReactNode) => (
    <section className="space-y-1.5" aria-label={AREA_TITLE[area]}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{AREA_TITLE[area]}</h3>
      <ul className="space-y-1 min-h-[2.25rem]">{items}</ul>
      <select
        aria-label={`Add a field to ${AREA_TITLE[area]}`}
        value=""
        onChange={e => {
          const f = info(e.target.value)
          if (f) change(l => withField(l, area, f.name, f.numeric))
        }}
        className={`${input} !py-1 text-xs`}
        disabled={!list.length}
      >
        <option value="">Add field…</option>
        {list.filter(f => area === 'values' || !has({ ...layout, values: [] }, f.name)).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
      </select>
    </section>
  )

  return (
    <Dialog
      title="PivotTable"
      onClose={onClose}
      width="sm:w-[600px]"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>Close</button>
          <button type="button" className={btnPrimary} onClick={() => create()}>{created ? 'Create again' : 'Create'}</button>
        </>
      }
    >
      <div onFocusCapture={picker.onFocusCapture} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RefField label="Table/Range:" value={source} onChange={v => { setSource(v); setCreated(null); dropError('source') }} picker={picker} pickKey="source" error={errors.source} autoFocus placeholder="e.g. $A$8:$K$68" />
          <RefField label="Location (existing worksheet):" value={target} onChange={v => { setTarget(v); setCreated(null); setReplace(null); dropError('target') }} picker={picker} pickKey="target" error={errors.target} placeholder="e.g. $M$3" />
        </div>

        <fieldset>
          <legend id={ids.fields} className="block text-xs font-medium text-ink-secondary mb-1">Choose fields to add to report:</legend>
          {typeof fields === 'string' ? (
            <p className="text-xs text-ink-muted bg-surface border border-edge rounded-md px-2.5 py-2">{FIELDS_HINT}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 bg-surface border border-edge rounded-md p-2 max-h-36 overflow-y-auto">
              {list.map(f => (
                <label key={f.name} className="flex items-center gap-2 text-sm text-ink cursor-pointer min-w-0">
                  <input type="checkbox" checked={has(layout, f.name)} onChange={e => toggle(f, e.target.checked)} className="accent-glow" />
                  <span className="truncate">{f.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {areaBox('filters', layout.filters.map((f, i) => row(`f-${f.field}`, f.field, 'filters', i, layout.filters.length, (
            <FilterItems field={info(f.field)} include={f.include} onChange={include => change(l => ({ ...l, filters: l.filters.map((x, k) => (k === i ? { ...x, include } : x)) }))} />
          ))))}
          {areaBox('columns', layout.columns.map((f, i) => row(`c-${f}`, f, 'columns', i, layout.columns.length)))}
          {areaBox('rows', layout.rows.map((f, i) => row(`r-${f}`, f, 'rows', i, layout.rows.length)))}
          {areaBox('values', layout.values.map((v, i) => row(`v-${i}-${v.field}`, `${AGG_LABEL[v.agg]} of ${v.field}`, 'values', i, layout.values.length, (
            <div className="grid grid-cols-2 gap-1.5">
              <select aria-label="Summarize value field by" value={v.agg} onChange={e => change(l => ({ ...l, values: l.values.map((x, k) => (k === i ? { ...x, agg: e.target.value as PivotAgg } : x)) }))} className="bg-surface border border-edge rounded px-1 py-0.5 text-[11px] text-ink-secondary">
                {(Object.keys(AGG_LABEL) as PivotAgg[]).map(a => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
              </select>
              <select aria-label="Show values as" value={v.show} onChange={e => change(l => ({ ...l, values: l.values.map((x, k) => (k === i ? { ...x, show: e.target.value as PivotShow } : x)) }))} className="bg-surface border border-edge rounded px-1 py-0.5 text-[11px] text-ink-secondary">
                {(Object.keys(SHOW_LABEL) as PivotShow[]).map(s => <option key={s} value={s}>{SHOW_LABEL[s]}</option>)}
              </select>
            </div>
          ))))}
        </div>

        {errors.form && <p role="alert" className="text-xs text-wrong">{errors.form}</p>}
        {replace && (
          <div role="alertdialog" aria-label="Replace existing data" className="flex flex-wrap items-center gap-2 bg-raised border border-s4/40 rounded-lg px-3 py-2">
            <p className="flex-1 min-w-[12rem] text-xs text-ink">There's already data in {replace}. Do you want to replace it?</p>
            <button type="button" className={btnSecondary} onClick={() => setReplace(null)}>No</button>
            <button type="button" autoFocus className={btnPrimary} onClick={() => create(true)}>Replace</button>
          </div>
        )}
        {created && <p role="status" className="text-xs text-correct">{created} Change the layout and press Create again to update it.</p>}
        <p className="text-[11px] text-ink-muted leading-relaxed">
          The PivotTable is written as values in Excel's default layout (Row Labels, Column Labels, Grand Total).
          Refresh = create again: after the source data changes, press Create again.
        </p>
      </div>
    </Dialog>
  )
}

function reorder(l: Layout, area: Area, i: number, d: -1 | 1): Layout {
  if (area === 'values') return { ...l, values: moved(l.values, i, d) }
  if (area === 'filters') return l
  return { ...l, [area]: moved(l[area], i, d) }
}

function FilterItems({ field, include, onChange }: { field?: PivotField; include: CellValue[]; onChange(include: CellValue[]): void }) {
  if (!field) return null
  const keys = new Set(include.map(valueKey))
  const all = include.length === 0
  const text = (v: CellValue) => (typeof v === 'number' && field.fmt ? formatNumber(v, field.fmt) : String(itemLabel(v)))
  const shown = all ? '(All)' : include.length === 1 ? text(include[0]) : '(Multiple Items)'
  const flip = (v: CellValue, on: boolean) => {
    const current = all ? field.items : field.items.filter(x => keys.has(valueKey(x)))
    const next = on ? [...current, v] : current.filter(x => valueKey(x) !== valueKey(v))
    onChange(next.length === field.items.length ? [] : next.length ? next : current)
  }
  return (
    <details className="text-[11px]">
      <summary className="cursor-pointer select-none text-ink-secondary">Show: <span className="text-ink">{shown}</span></summary>
      <div className="mt-1 max-h-32 overflow-y-auto bg-base border border-edge rounded py-1">
        <label className="flex items-center gap-2 px-2 py-0.5 text-ink cursor-pointer">
          <input type="checkbox" checked={all} onChange={e => onChange(e.target.checked ? [] : field.items.slice(0, 1))} className="accent-glow" /> (All)
        </label>
        {field.items.map(v => (
          <label key={valueKey(v)} className="flex items-center gap-2 px-2 py-0.5 text-ink cursor-pointer">
            <input type="checkbox" checked={all || keys.has(valueKey(v))} onChange={e => flip(v, e.target.checked)} className="accent-glow" />
            <span className="truncate">{text(v)}</span>
          </label>
        ))}
      </div>
    </details>
  )
}
