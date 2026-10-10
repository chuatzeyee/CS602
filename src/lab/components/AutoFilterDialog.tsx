import { useId, useMemo, useState } from 'react'
import { ArrowDownAZ, ArrowUpZA, X } from 'lucide-react'
import type { CellValue, LabSheet, ToolDialogProps } from '../types'
import { colIndex, toRange, toRef } from '../refs'
import { absRange, boxIn, isBlank, showAllRows, valueKey } from '../tools/advFilter'
import { applyAutoFilter, describeFilter, getAutoFilter, OP_LABEL } from '../tools/autoFilter'
import type { AutoFilterColumn, ColumnFilter, CustomOp } from '../tools/autoFilter'
import { applySort, compareCells } from '../tools/sort'
import Dialog from './Dialog'
import RefField, { useRefPicker } from './RefField'
import { normRef, refProblem } from './refUtil'
import { listBox, startRegion } from './toolRange'
import { btnGhost, btnPrimary, btnSecondary, input, label as labelCls, monoInput } from './ui'

type Kind = 'number' | 'date' | 'text'
type Choice =
  | 'values' | 'custom' | 'between' | 'top10' | 'above' | 'below'
  | 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le' | 'begins' | 'ends' | 'contains' | 'notContains'

const MENUS: Record<Kind, { title: string; items: [Choice, string][] }> = {
  number: {
    title: 'Number Filters',
    items: [['eq', 'Equals…'], ['ne', 'Does Not Equal…'], ['gt', 'Greater Than…'], ['ge', 'Greater Than Or Equal To…'], ['lt', 'Less Than…'],
      ['le', 'Less Than Or Equal To…'], ['between', 'Between…'], ['top10', 'Top 10…'], ['above', 'Above Average'], ['below', 'Below Average'], ['custom', 'Custom Filter…']],
  },
  date: {
    title: 'Date Filters',
    items: [['eq', 'Equals…'], ['lt', 'Before…'], ['gt', 'After…'], ['between', 'Between…'], ['custom', 'Custom Filter…']],
  },
  text: {
    title: 'Text Filters',
    items: [['eq', 'Equals…'], ['ne', 'Does Not Equal…'], ['begins', 'Begins With…'], ['ends', 'Ends With…'], ['contains', 'Contains…'], ['notContains', 'Does Not Contain…'], ['custom', 'Custom Filter…']],
  },
}
const DATE_FMT = /[dy]|m{3,}/i

interface Item { key: string; value: CellValue; text: string }
interface Draft {
  choice: Choice
  checked: Set<string>
  op1: CustomOp
  v1: string
  join: 'and' | 'or'
  op2: CustomOp | ''
  v2: string
  top: boolean
  count: string
  percent: boolean
}

const lastRange = new WeakMap<LabSheet, string>()

const DATE_OPS: Partial<Record<CustomOp, string>> = { lt: 'is before', gt: 'is after', ge: 'is after or equal to', le: 'is before or equal to' }
const opText = (op: CustomOp, kind: Kind) => (kind === 'date' ? DATE_OPS[op] : undefined) ?? OP_LABEL[op]
const ORDER_TEXT: Record<Kind, [string, string]> = {
  number: ['Smallest to Largest', 'Largest to Smallest'],
  date: ['Oldest to Newest', 'Newest to Oldest'],
  text: ['A to Z', 'Z to A'],
}

function blankDraft(items: Item[]): Draft {
  return { choice: 'values', checked: new Set(items.map(i => i.key)), op1: 'eq', v1: '', join: 'and', op2: '', v2: '', top: true, count: '10', percent: false }
}

function draftOf(f: ColumnFilter | undefined, items: Item[]): Draft {
  const d = blankDraft(items)
  if (!f) return d
  switch (f.type) {
    case 'values': {
      const keys = new Set(f.values.map(valueKey))
      if (f.blanks) keys.add(valueKey(null))
      return { ...d, checked: new Set(items.filter(i => keys.has(i.key)).map(i => i.key)) }
    }
    case 'custom': {
      const [a, b] = f.rules
      return { ...d, choice: 'custom', op1: a.op, v1: String(a.value), join: f.join ?? 'and', op2: b?.op ?? '', v2: b ? String(b.value) : '' }
    }
    case 'top10': return { ...d, choice: 'top10', top: f.top !== false, count: String(f.count), percent: f.percent === true }
    case 'average': return { ...d, choice: f.above ? 'above' : 'below' }
  }
}

export default function AutoFilterDialog({ sheet, selection, onClose, onDone }: ToolDialogProps) {
  const picker = useRefPicker(selection)
  const [range, setRange] = useState(() => {
    const prev = boxIn(sheet, getAutoFilter(sheet)?.range ?? lastRange.get(sheet) ?? '', 'range')
    if (typeof prev !== 'string') return absRange(prev)
    const region = startRegion(sheet, selection)
    return region ? absRange(region) : ''
  })
  const version = sheet.version   // modeless: the list can change while the dialog is open
  const box = useMemo(() => {
    const b = listBox(sheet, range)
    return !b || b.r2 <= b.r1 ? null : b
  }, [sheet, range, version])
  const headers = useMemo(() => (box ? sheet.values(toRange({ ...box, r2: box.r1 }))[0] ?? [] : []), [sheet, box, version])
  // a column is named by its header, or by its letter when the header cell is blank
  const columns = useMemo(() => headers.map((h, j) => {
    const name = h === null ? '' : String(h).trim()
    const letter = toRef(0, (box?.c1 ?? 0) + j).replace(/\d+$/, '')
    return { key: name || letter, label: name || `Column ${letter}`, index: j }
  }), [headers, box])

  const [filters, setFilters] = useState<AutoFilterColumn[]>(() => getAutoFilter(sheet)?.columns ?? [])
  const [column, setColumn] = useState(() => {
    const active = normRef(selection).split(':')[0]
    const m = /^([A-Z]+)/.exec(active)
    const b = boxIn(sheet, normRef(range), 'range')
    if (m && typeof b !== 'string') {
      const j = colIndex(m[1]) - b.c1
      const h = sheet.values(toRef(b.r1, b.c1 + Math.max(0, j)))[0]?.[0]
      if (j >= 0 && j <= b.c2 - b.c1 && h !== null && String(h).trim() !== '') return String(h).trim()
    }
    return ''
  })
  const col = columns.find(c => c.key === column) ?? columns[0]

  // the column's values: kind (number / date / text) and its checklist
  const { kind, items } = useMemo(() => {
    if (!box || !col) return { kind: 'text' as Kind, items: [] as Item[] }
    const c = box.c1 + col.index
    const vals = sheet.values(toRange({ r1: box.r1 + 1, c1: c, r2: box.r2, c2: c })).map(r => r[0] ?? null)
    const seen = new Map<string, Item>()
    vals.forEach((v, i) => {
      const key = valueKey(v)
      if (!seen.has(key)) seen.set(key, { key, value: v, text: isBlank(v) ? '(Blanks)' : sheet.display(toRef(box.r1 + 1 + i, c)) })
    })
    const list = [...seen.values()].sort((a, b) => compareCells(a.value, b.value))
    const filled = vals.filter(v => !isBlank(v))
    const firstNum = vals.findIndex(v => typeof v === 'number')
    let k: Kind = 'text'
    if (filled.length && firstNum >= 0 && filled.every(v => typeof v === 'number')) {
      k = DATE_FMT.test(sheet.fmt(toRef(box.r1 + 1 + firstNum, c)) ?? '') ? 'date' : 'number'
    }
    return { kind: k, items: list }
  }, [sheet, box, col, version])

  // one draft per column, started from that column's active filter
  const colKey = col?.key ?? ''
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const draft = drafts[colKey] ?? draftOf(filters.find(f => f.column.toLowerCase() === colKey.toLowerCase())?.filter, items)
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [found, setFound] = useState<string | null>(null)
  const ids = { col: useId(), choice: useId(), list: useId(), search: useId(), op1: useId(), v1: useId(), op2: useId(), v2: useId(), count: useId() }

  const set = (patch: Partial<Draft>) => setDrafts(all => ({ ...all, [colKey]: { ...draft, ...patch } }))
  const choose = (choice: Choice) => {
    const preset: Partial<Draft> = { choice }
    if (['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'begins', 'ends', 'contains', 'notContains'].includes(choice)) {
      Object.assign(preset, { op1: choice as CustomOp, op2: '', v2: '' })
    }
    if (choice === 'between') Object.assign(preset, { op1: 'ge', op2: 'le', join: 'and' })
    set(preset)
    setErrors({})
  }

  const isCustom = !['values', 'top10', 'above', 'below'].includes(draft.choice)
  const shownItems = items.filter(i => !search || i.text.toLowerCase().includes(search.toLowerCase()))
  const allChecked = items.every(i => draft.checked.has(i.key))

  const filterFromDraft = (): ColumnFilter | null | string => {
    if (draft.choice === 'values') {
      if (!draft.checked.size) return 'Tick at least one value.'
      if (allChecked) return null
      const picked = items.filter(i => draft.checked.has(i.key))
      return { type: 'values', values: picked.filter(i => !isBlank(i.value)).map(i => i.value), blanks: picked.some(i => isBlank(i.value)) }
    }
    if (draft.choice === 'top10') {
      const n = Number(draft.count)
      if (!Number.isInteger(n) || n < 1 || n > (draft.percent ? 100 : 500)) return `Enter a whole number from 1 to ${draft.percent ? 100 : 500}.`
      return { type: 'top10', top: draft.top, count: n, percent: draft.percent }
    }
    if (draft.choice === 'above' || draft.choice === 'below') return { type: 'average', above: draft.choice === 'above' }
    if (draft.v1.trim() === '' && !['eq', 'ne'].includes(draft.op1)) return 'Enter a value for the first condition.'
    const rules = [{ op: draft.op1, value: draft.v1 }]
    if (draft.op2 && draft.v2.trim() !== '') rules.push({ op: draft.op2, value: draft.v2 })
    else if (draft.choice === 'between') return 'Enter both ends of the range.'
    return { type: 'custom', rules, join: draft.join }
  }

  const run = (next: AutoFilterColumn[]): boolean => {
    const r = refProblem(range, { rows: sheet.rows, cols: sheet.cols })
    if (r) {
      setErrors({ range: r })
      return false
    }
    const res = applyAutoFilter(sheet, { range: normRef(range), columns: next })
    if (!res.ok) {
      setErrors({ form: res.message })
      return false
    }
    setFilters(next)
    lastRange.set(sheet, normRef(range))
    const total = box ? box.r2 - box.r1 : 0
    const shown = getAutoFilter(sheet)?.shown ?? total
    const text = next.length ? `${shown} of ${total} records found` : 'All filters cleared: every row is shown'
    setFound(text)
    onDone(next.length ? `Filter: ${text}` : text)
    return true
  }

  const apply = () => {
    if (!col) {
      setErrors({ range: 'Choose a list with a header row.' })
      return
    }
    const f = filterFromDraft()
    if (typeof f === 'string') {
      setErrors({ draft: f })
      return
    }
    setErrors({})
    const others = filters.filter(x => x.column.toLowerCase() !== col.key.toLowerCase())
    run(f ? [...others, { column: col.key, filter: f }] : others)
  }

  const sortBy = (order: 'asc' | 'desc') => {
    if (!box || !col) return
    if (sheet.hiddenRows.size) showAllRows(sheet, toRange({ ...box, r1: box.r1 + 1 }))
    const res = applySort(sheet, { range: normRef(range), headers: true, levels: [{ column: col.key, order }] })
    if (filters.length) applyAutoFilter(sheet, { range: normRef(range), columns: filters })
    if (!res.ok) setErrors({ form: res.message })
    else onDone(`Sorted by ${col.label} (${ORDER_TEXT[kind][order === 'asc' ? 0 : 1]})`)
  }

  const opOptions = (allowNone: boolean) => (
    <>
      {allowNone && <option value="">(none)</option>}
      {(Object.keys(OP_LABEL) as CustomOp[]).map(op => (
        <option key={op} value={op}>{opText(op, kind)}</option>
      ))}
    </>
  )

  return (
    <Dialog
      title="Filter (AutoFilter)"
      onClose={onClose}
      width="sm:w-[520px]"
      footer={
        <>
          <button type="button" className={`${btnSecondary} mr-auto`} onClick={() => run([])} disabled={!filters.length && sheet.hiddenRows.size === 0}>Clear All</button>
          <button type="button" className={btnSecondary} onClick={onClose}>Close</button>
          <button type="button" className={btnPrimary} onClick={apply} disabled={!col}>Apply</button>
        </>
      }
    >
      <div onFocusCapture={picker.onFocusCapture} className="space-y-3">
        <RefField label="List range (headers in the first row):" value={range} onChange={setRange} picker={picker} pickKey="range" error={errors.range} placeholder="e.g. $A$8:$K$68" />
        {!columns.length && !errors.range && <p className="text-xs text-ink-muted">Select a cell inside your list (or type its range) to filter its columns.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label htmlFor={ids.col} className={labelCls}>Column:</label>
            <select id={ids.col} value={colKey} onChange={e => { setColumn(e.target.value); setSearch(''); setErrors({}) }} className={input} disabled={!columns.length}>
              {columns.map(c => <option key={c.key} value={c.key}>{c.label}{filters.some(f => f.column.toLowerCase() === c.key.toLowerCase()) ? ' (filtered)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={ids.choice} className={labelCls}>Filter:</label>
            <select id={ids.choice} value={draft.choice} onChange={e => choose(e.target.value as Choice)} className={input} disabled={!col}>
              <option value="values">Values (checklist)</option>
              <optgroup label={MENUS[kind].title}>
                {MENUS[kind].items.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </optgroup>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={btnSecondary} onClick={() => sortBy('asc')} disabled={!col}>
            <ArrowDownAZ size={13} /> Sort {ORDER_TEXT[kind][0]}
          </button>
          <button type="button" className={btnSecondary} onClick={() => sortBy('desc')} disabled={!col}>
            <ArrowUpZA size={13} /> Sort {ORDER_TEXT[kind][1]}
          </button>
        </div>

        {col && draft.choice === 'values' && (
          <div className="space-y-1.5">
            <label htmlFor={ids.search} className="sr-only">Search values</label>
            <input id={ids.search} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" className={input} />
            <div role="group" aria-labelledby={ids.list} className="max-h-48 overflow-y-auto bg-surface border border-edge rounded-md py-1">
              <span id={ids.list} className="sr-only">Values of {col.label}</span>
              <label className="flex items-center gap-2 px-2.5 py-1 text-sm text-ink cursor-pointer hover:bg-raised">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = !allChecked && draft.checked.size > 0 }}
                  onChange={e => set({ checked: e.target.checked ? new Set(items.map(i => i.key)) : new Set() })}
                  className="accent-glow"
                />
                (Select All)
              </label>
              {shownItems.map(i => (
                <label key={i.key} className="flex items-center gap-2 px-2.5 py-1 text-sm text-ink cursor-pointer hover:bg-raised">
                  <input
                    type="checkbox"
                    checked={draft.checked.has(i.key)}
                    onChange={e => {
                      const next = new Set(draft.checked)
                      if (e.target.checked) next.add(i.key)
                      else next.delete(i.key)
                      set({ checked: next })
                    }}
                    className="accent-glow"
                  />
                  <span className="truncate">{i.text}</span>
                </label>
              ))}
              {!shownItems.length && <p className="px-2.5 py-1.5 text-xs text-ink-faint">No matches.</p>}
            </div>
          </div>
        )}

        {col && isCustom && (
          <fieldset className="bg-raised border border-edge-bright rounded-lg p-3 space-y-2">
            <legend className="px-1 text-xs font-semibold text-ink">Custom AutoFilter</legend>
            <p className="text-xs text-ink-secondary">Show rows where: <span className="text-ink font-medium">{col.label}</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2">
              <select id={ids.op1} aria-label="First operator" value={draft.op1} onChange={e => set({ op1: e.target.value as CustomOp })} className={input}>{opOptions(false)}</select>
              <input id={ids.v1} aria-label="First value" list={`${ids.v1}-list`} value={draft.v1} onChange={e => set({ v1: e.target.value })} className={monoInput} placeholder={kind === 'date' ? '1 Mar 2026' : kind === 'number' ? '20' : 'North*'} />
            </div>
            <div className="flex items-center gap-4 text-sm text-ink">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="af-join" checked={draft.join === 'and'} onChange={() => set({ join: 'and' })} className="accent-glow" /> And</label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="af-join" checked={draft.join === 'or'} onChange={() => set({ join: 'or' })} className="accent-glow" /> Or</label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2">
              <select id={ids.op2} aria-label="Second operator" value={draft.op2} onChange={e => set({ op2: e.target.value as CustomOp | '' })} className={input}>{opOptions(true)}</select>
              <input id={ids.v2} aria-label="Second value" list={`${ids.v1}-list`} value={draft.v2} onChange={e => set({ v2: e.target.value })} disabled={!draft.op2} className={monoInput} />
            </div>
            <datalist id={`${ids.v1}-list`}>
              {items.filter(i => !isBlank(i.value)).slice(0, 200).map(i => <option key={i.key} value={i.text} />)}
            </datalist>
            <p className="text-[11px] text-ink-muted">Use ? to represent any single character. Use * to represent any series of characters.</p>
          </fieldset>
        )}

        {col && draft.choice === 'top10' && (
          <fieldset className="bg-raised border border-edge-bright rounded-lg p-3 space-y-2">
            <legend className="px-1 text-xs font-semibold text-ink">Top 10 AutoFilter</legend>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Top or bottom" value={draft.top ? 'top' : 'bottom'} onChange={e => set({ top: e.target.value === 'top' })} className={`${input} !w-28`}>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
              <label htmlFor={ids.count} className="sr-only">How many</label>
              <input id={ids.count} value={draft.count} inputMode="numeric" onChange={e => set({ count: e.target.value })} className={`${monoInput} !w-20`} />
              <select aria-label="Items or percent" value={draft.percent ? 'percent' : 'items'} onChange={e => set({ percent: e.target.value === 'percent' })} className={`${input} !w-28`}>
                <option value="items">Items</option>
                <option value="percent">Percent</option>
              </select>
            </div>
            <p className="text-[11px] text-ink-muted">Ties at the cut-off are all shown, so you can see more rows than you asked for.</p>
          </fieldset>
        )}

        {col && (draft.choice === 'above' || draft.choice === 'below') && (
          <p className="text-xs text-ink-secondary">Shows the rows whose {col.label} is {draft.choice === 'above' ? 'above' : 'below'} the average of the whole column.</p>
        )}

        {errors.draft && <p role="alert" className="text-xs text-wrong">{errors.draft}</p>}
        {errors.form && <p role="alert" className="text-xs text-wrong">{errors.form}</p>}

        <div className="space-y-1">
          <p className="text-xs font-medium text-ink-secondary">Active filters {filters.length > 1 && <span className="text-ink-muted font-normal">(combined with AND)</span>}</p>
          {filters.length === 0 ? (
            <p className="text-xs text-ink-faint">None. Columns you filter are combined with AND; for OR across columns use Advanced Filter.</p>
          ) : (
            <ul className="space-y-1">
              {filters.map(f => (
                <li key={f.column} className="flex items-center gap-2 bg-surface border border-edge rounded-md px-2.5 py-1 text-xs">
                  <span className="font-medium text-ink">{f.column}</span>
                  <span className="text-ink-secondary truncate flex-1">{describeFilter(f.filter)}</span>
                  <button
                    type="button"
                    className={`${btnGhost} !px-1 !py-0.5`}
                    aria-label={`Clear filter from ${f.column}`}
                    title={`Clear Filter From "${f.column}"`}
                    onClick={() => run(filters.filter(x => x !== f))}
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filters.length > 0 && (
            <button type="button" className={`${btnGhost} !px-0`} onClick={() => run(filters)} title="Data > Reapply: run the filters again after editing the data">Reapply</button>
          )}
          {found && <p role="status" className="text-xs text-correct">{found}</p>}
        </div>
      </div>
    </Dialog>
  )
}
