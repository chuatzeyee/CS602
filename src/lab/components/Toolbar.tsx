import type { ReactNode } from 'react'
import {
  ArrowDownToLine, ArrowDownUp, ArrowRightToLine, Calculator, Funnel, Goal, ListChecks, ListFilter, LoaderCircle,
  Repeat, RotateCcw, SquareTerminal, Table2, Target, Undo2, Redo2,
} from 'lucide-react'
import type { Exercise, LabSheet } from '../types'
import MenuButton from './Menu'
import { needsIterative } from './playerTypes'
import { colName } from './refUtil'
import { btnPrimary, btnTool } from './ui'

export type ToolKey = 'goalseek' | 'datatable' | 'solver' | 'sort' | 'autofilter' | 'advfilter' | 'pivot'

type CycleView = Pick<LabSheet, 'rows' | 'cols' | 'values' | 'read'>

// a circular reference with iteration off: some cell of the sheet shows #CYCLE!
export function showsCycle(sheet: CycleView): boolean {
  if (sheet.rows < 1 || sheet.cols < 1) return false
  return sheet.values(`A1:${colName(sheet.cols - 1)}${sheet.rows}`).some((line, r) =>
    line.some((v, c) => v === '#CYCLE!' && sheet.read(`${colName(c)}${r + 1}`).kind === 'error'))
}

// the Iterative button: always in the sandbox; in an exercise whose sheet starts iterative, while iteration is on, while
// the sheet shows #CYCLE!, or when the exercise's text talks about circular references or iteration
export function iterativeToggleWanted(exercise: Exercise, sandbox: boolean, sheet: (CycleView & Pick<LabSheet, 'iterative'>) | null): boolean {
  if (sandbox || needsIterative(exercise)) return true
  const text = [exercise.scenario, ...exercise.tasks.flatMap(t => [t.prompt, ...(t.hints ?? [])])].join(' ')
  if (/circular|iterat/i.test(text)) return true
  return Boolean(sheet && (sheet.iterative || showsCycle(sheet)))
}

export const NUMBER_FORMATS: { key: string; label: string; code: string | undefined }[] = [
  { key: 'general', label: 'General', code: undefined },
  { key: 'number', label: 'Number', code: '0.00' },
  { key: 'currency', label: 'Currency', code: '$#,##0.00' },
  { key: 'percent', label: 'Percent', code: '0.0%' },
  { key: 'date', label: 'Date', code: 'dd-mmm-yy' },
  { key: 'time', label: 'Time', code: 'hh:mm:ss' },
  { key: 'duration', label: 'Duration', code: '[h]:mm' },
]

export interface ToolbarProps {
  check?: { busy: boolean; onCheck(): void; summary?: ReactNode }
  canUndo: boolean
  canRedo: boolean
  onUndo(): void
  onRedo(): void
  onFillDown(): void
  onFillRight(): void
  format: string | undefined
  onFormat(code: string | undefined): void
  onCustomFormat(): void
  onRecalc(): void
  iterative?: { on: boolean; onToggle(): void }
  tools: ToolKey[]
  onTool(tool: ToolKey): void
  vba?: { open: boolean; onToggle(): void }
  onReset(): void
  readOnly?: boolean
}

const Sep = () => <span className="hidden sm:block w-px h-5 bg-edge mx-1 flex-shrink-0" aria-hidden />

function ToolButton({ icon, label, title, onClick, pressed, disabled, wideLabel }: {
  icon: ReactNode; label: string; title?: string; onClick(): void; pressed?: boolean; disabled?: boolean; wideLabel?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={label}
      aria-pressed={pressed}
      className={`${btnTool} flex-shrink-0 ${pressed ? '!text-glow !bg-glow-dim/60' : ''}`}
    >
      {icon}
      <span className={wideLabel ? 'hidden md:inline' : 'sr-only'}>{label}</span>
    </button>
  )
}

export default function Toolbar(p: ToolbarProps) {
  const fmtName = NUMBER_FORMATS.find(f => f.code === p.format)?.label ?? (p.format ? 'Custom' : 'General')
  const has = (t: ToolKey) => p.tools.includes(t)
  const whatIf = [
    has('goalseek') && { key: 'goalseek', label: 'Goal Seek…', onSelect: () => p.onTool('goalseek') },
    has('datatable') && { key: 'datatable', label: 'Data Table…', onSelect: () => p.onTool('datatable') },
  ].filter(x => x !== false)

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-edge bg-base" role="toolbar" aria-label="Spreadsheet tools">
      {p.check && (
        <>
          <button
            type="button"
            onClick={p.check.onCheck}
            disabled={p.check.busy}
            className={`${btnPrimary} flex-shrink-0 min-w-[5.5rem]`}
            aria-busy={p.check.busy}
          >
            {p.check.busy ? <LoaderCircle size={14} className="animate-spin" /> : <ListChecks size={14} />}
            {p.check.busy ? 'Checking…' : 'Check'}
          </button>
          {p.check.summary && <span className="flex-shrink-0 px-2 text-xs font-mono">{p.check.summary}</span>}
          <Sep />
        </>
      )}
      <ToolButton icon={<Undo2 size={15} />} label="Undo" title="Undo (Ctrl+Z)" onClick={p.onUndo} disabled={!p.canUndo || p.readOnly} />
      <ToolButton icon={<Redo2 size={15} />} label="Redo" title="Redo (Ctrl+Y)" onClick={p.onRedo} disabled={!p.canRedo || p.readOnly} />
      <Sep />
      <ToolButton icon={<ArrowDownToLine size={15} />} label="Fill Down" title="Fill Down (Ctrl+D): copy the top row of the selection down" onClick={p.onFillDown} disabled={p.readOnly} />
      <ToolButton icon={<ArrowRightToLine size={15} />} label="Fill Right" title="Fill Right (Ctrl+R): copy the left column of the selection right" onClick={p.onFillRight} disabled={p.readOnly} />
      <MenuButton
        className={`${btnTool} flex-shrink-0 font-mono`}
        title="Number format of the selection"
        ariaLabel={`Number format: ${fmtName}`}
        label={<span className="max-w-[5.5rem] truncate">{fmtName}</span>}
        items={[
          ...NUMBER_FORMATS.map(f => ({
            key: f.key,
            label: f.label,
            hint: f.code ?? '',
            checked: f.code === p.format,
            disabled: p.readOnly,
            onSelect: () => p.onFormat(f.code),
          })),
          { key: 'custom', label: 'Custom…', hint: p.format && !NUMBER_FORMATS.some(f => f.code === p.format) ? p.format : '', disabled: p.readOnly, onSelect: p.onCustomFormat },
        ]}
      />
      <Sep />
      <ToolButton icon={<Calculator size={15} />} label="Calculate Now" title="Calculate Now (F9): new random draws and data tables re-run" onClick={p.onRecalc} />
      {p.iterative && (
        <ToolButton
          icon={<Repeat size={15} />}
          label="Iterative"
          title={`Iterative calculation is ${p.iterative.on ? 'on' : 'off'} (100 iterations, max change 0.001)`}
          onClick={p.iterative.onToggle}
          pressed={p.iterative.on}
          wideLabel
        />
      )}
      {(whatIf.length > 0 || p.tools.some(t => t !== 'goalseek' && t !== 'datatable') || p.vba) && <Sep />}
      {whatIf.length > 0 && (
        <MenuButton
          className={`${btnTool} flex-shrink-0`}
          title="What-If Analysis"
          ariaLabel="What-If Analysis"
          label={<><Target size={15} /><span className="hidden md:inline">What-If</span></>}
          items={whatIf}
        />
      )}
      {has('solver') && <ToolButton icon={<Goal size={15} />} label="Solver" onClick={() => p.onTool('solver')} wideLabel />}
      {has('sort') && <ToolButton icon={<ArrowDownUp size={15} />} label="Sort" onClick={() => p.onTool('sort')} wideLabel />}
      {has('autofilter') && <ToolButton icon={<Funnel size={15} />} label="Filter" title="Filter (AutoFilter)" onClick={() => p.onTool('autofilter')} wideLabel />}
      {has('advfilter') && <ToolButton icon={<ListFilter size={15} />} label="Advanced" title="Advanced Filter" onClick={() => p.onTool('advfilter')} wideLabel />}
      {has('pivot') && <ToolButton icon={<Table2 size={15} />} label="PivotTable" onClick={() => p.onTool('pivot')} wideLabel />}
      {p.vba && <ToolButton icon={<SquareTerminal size={15} />} label="VBA" title="VBA editor" onClick={p.vba.onToggle} pressed={p.vba.open} wideLabel />}
      <span className="flex-1 min-w-2" />
      <ToolButton icon={<RotateCcw size={15} />} label="Reset" title="Reset the sheet to the start" onClick={p.onReset} disabled={p.readOnly} wideLabel />
    </div>
  )
}
