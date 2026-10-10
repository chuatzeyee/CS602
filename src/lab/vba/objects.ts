// objects.ts - excelScope(host): the Excel object model as VBA globals (Range, Cells, ActiveCell, Selection,
// Application, Worksheets, WorksheetFunction, Intersect, Calculate ...) plus the xl constants. One scope per run: it
// holds the clipboard and the Application settings. See DESIGN.md for the lookup order.
import { bool, lng, obj, own, VbaError } from './runtime'
import type { Global, GlobalScope, Val, VbaHost, VbaObject } from './runtime'
import type { HostExtras } from './labHost'
import type { Box, RangeView, Whole, XlState } from './objectsCore'
import { makeRange } from './objectsRange'
import { rangeArgs } from './objectsNav'
import {
  activeCell, intersect, makeApplication, makeWorkbook, makeWorksheet, selectionRange, sheetCells, sheetColumns, sheetRows, sheetsGlobal, union,
  workbooksGlobal,
} from './objectsApp'
import { evaluateText, worksheetFunctionObject } from './objectsWsf'
import { toStr } from './coerce'

/** xl... constants (Long) */
export const XL_CONSTANTS: Record<string, number> = {
  xlDown: -4121, xlUp: -4162, xlToRight: -4161, xlToLeft: -4159,
  xlShiftUp: -4162, xlShiftToLeft: -4159, xlShiftDown: -4121, xlShiftToRight: -4161,
  xlPasteAll: -4104, xlPasteValues: -4163, xlPasteFormulas: -4123, xlPasteFormats: -4122,
  xlPasteValuesAndNumberFormats: 12, xlPasteFormulasAndNumberFormats: 11, xlPasteAllExceptBorders: 7,
  xlPasteColumnWidths: 8, xlPasteComments: -4144, xlPasteValidation: 6, xlPasteAllUsingSourceTheme: 13,
  xlPasteAllMergingConditionalFormats: 14,
  xlPasteSpecialOperationNone: -4142, xlPasteSpecialOperationAdd: 2, xlPasteSpecialOperationSubtract: 3,
  xlPasteSpecialOperationMultiply: 4, xlPasteSpecialOperationDivide: 5,
  xlNone: -4142, xlColorIndexNone: -4142, xlColorIndexAutomatic: -4105, xlAutomatic: -4105, xlSolid: 1,
  xlCalculationAutomatic: -4105, xlCalculationManual: -4135, xlCalculationSemiautomatic: 2,
  xlCopy: 1, xlCut: 2, xlA1: 1, xlR1C1: -4150,
  xlGeneral: 1, xlLeft: -4131, xlCenter: -4108, xlRight: -4152, xlJustify: -4130, xlFill: 5, xlDistributed: -4117,
  xlCenterAcrossSelection: 7, xlTop: -4160, xlBottom: -4107,
  xlUnderlineStyleNone: -4142, xlUnderlineStyleSingle: 2, xlUnderlineStyleDouble: -4119,
  xlErrDiv0: 2007, xlErrNA: 2042, xlErrName: 2029, xlErrNull: 2000, xlErrNum: 2036, xlErrRef: 2023, xlErrValue: 2015,
  xlSheetVisible: -1, xlSheetHidden: 0, xlSheetVeryHidden: 2, xlWorksheet: -4167,
  xlMaximized: -4137, xlMinimized: -4140, xlNormal: -4143, xlWait: 2, xlDefault: -4143,
  xlValues: -4163, xlFormulas: -4123, xlWhole: 1, xlPart: 2, xlByRows: 1, xlByColumns: 2, xlNext: 1, xlPrevious: 2,
  xlAscending: 1, xlDescending: 2, xlYes: 1, xlNo: 2, xlGuess: 0,
  xlCellTypeBlanks: 4, xlCellTypeConstants: 2, xlCellTypeFormulas: -4123, xlCellTypeLastCell: 11, xlCellTypeVisible: 12,
  xlContinuous: 1, xlThin: 2, xlMedium: -4138, xlThick: 4, xlHairline: 1,
  xlEdgeLeft: 7, xlEdgeTop: 8, xlEdgeBottom: 9, xlEdgeRight: 10, xlInsideVertical: 11, xlInsideHorizontal: 12,
  xlRangeValueDefault: 10,
  xlDiagonalDown: 5, xlDiagonalUp: 6, xlLineStyleNone: -4142, xlDash: -4115, xlDot: -4118, xlDouble: -4119, xlDashDot: 4,
  xlContext: -5002, xlLTR: -5003, xlRTL: -5004, xlPatternSolid: 1, xlPatternNone: -4142,
  xlThemeColorDark1: 1, xlThemeColorLight1: 2, xlThemeColorDark2: 3, xlThemeColorLight2: 4, xlThemeColorAccent1: 5,
  xlThemeColorAccent2: 6, xlThemeColorAccent3: 7, xlThemeColorAccent4: 8, xlThemeColorAccent5: 9, xlThemeColorAccent6: 10,
  xlThemeFontNone: 0, xlThemeFontMajor: 1, xlThemeFontMinor: 2,
  xlFillDefault: 0, xlFillCopy: 1, xlFillSeries: 2, xlFillFormats: 3, xlFillValues: 4, xlFillDays: 5, xlFillWeekdays: 6,
  xlFillMonths: 7, xlFillYears: 8, xlLinearTrend: 9, xlGrowthTrend: 10,
  xlHAlignCenter: -4108, xlHAlignLeft: -4131, xlHAlignRight: -4152, xlHAlignGeneral: 1, xlVAlignCenter: -4108,
  xlVAlignTop: -4160, xlVAlignBottom: -4107, xlUnderlineStyleSingleAccounting: 4, xlUnderlineStyleDoubleAccounting: 5,
}

function createState(host: VbaHost): XlState {
  const extras = host as Partial<HostExtras>
  let sheet: VbaObject | undefined
  let book: VbaObject | undefined
  const workbook = (): VbaObject => (book ??= makeWorkbook(st))
  const st: XlState = {
    host,
    extras: {
      setNow: typeof extras.setNow === 'function' ? extras.setNow.bind(host) : undefined,
      locked: typeof extras.locked === 'function' ? extras.locked.bind(host) : undefined,
      hasFormula: typeof extras.hasFormula === 'function' ? extras.hasFormula.bind(host) : undefined,
      evaluateArray: typeof extras.evaluateArray === 'function' ? extras.evaluateArray.bind(host) : undefined,
      batch: typeof extras.batch === 'function' ? extras.batch.bind(host) : undefined,
      knowsFunction: typeof extras.knowsFunction === 'function' ? extras.knowsFunction.bind(host) : undefined,
      deleteCells: typeof extras.deleteCells === 'function' ? extras.deleteCells.bind(host) : undefined,
      insertCells: typeof extras.insertCells === 'function' ? extras.insertCells.bind(host) : undefined,
      moveCells: typeof extras.moveCells === 'function' ? extras.moveCells.bind(host) : undefined,
    },
    clip: null,
    app: new Map<string, Val>(),
    cellProps: new Map<string, Val>(),
    makeRange: (areas: Box[], view?: RangeView, whole?: Whole) => makeRange(st, areas, view, whole),
    worksheet: () => (sheet ??= makeWorksheet(st, workbook)),
  }
  return st
}

// ActiveWindow: the recorder writes SmallScroll / ScrollRow whenever the learner scrolls; the lab accepts and ignores them
function activeWindow(): VbaObject {
  const props = new Map<string, Val>([
    ['scrollrow', lng(1)], ['scrollcolumn', lng(1)], ['zoom', lng(100)], ['freezepanes', bool(false)],
    ['displaygridlines', bool(true)], ['displayheadings', bool(true)], ['splitrow', lng(0)], ['splitcolumn', lng(0)],
  ])
  const noop = (): Val => bool(true)
  const methods: Record<string, () => Val> = { smallscroll: noop, largescroll: noop, scrollworkbooktabs: noop, activate: noop }
  const read = (name: string): Val => {
    const key = name.toLowerCase()
    const v = props.get(key) ?? own(methods, key)?.()
    if (!v) throw new VbaError(438, `Object doesn't support this property or method: Window.${name}`)
    return v
  }
  return {
    className: 'Window',
    get: read,
    call: read,
    set(name, _args, value) {
      if (!props.has(name.toLowerCase())) throw new VbaError(438, `Object doesn't support this property or method: Window.${name}`)
      props.set(name.toLowerCase(), value)
    },
  }
}

/** the Excel object model over a host, as VBA globals (keys in lower case) */
export function excelScope(host: VbaHost): GlobalScope {
  const st = createState(host)
  let app: VbaObject | undefined
  let book: VbaObject | undefined
  const application = (): VbaObject => (app ??= makeApplication(st, () => (book ??= makeWorkbook(st))))
  const scope = new Map<string, Global>()
  const fn = (name: string, f: (args: Val[], named: Record<string, Val>) => Val, statementOk = false): void => {
    scope.set(name.toLowerCase(), { kind: 'fn', fn: (_ctx, args, named) => f(args, named), statementOk })
  }
  const object = (name: string, get: () => VbaObject): void => {
    scope.set(name.toLowerCase(), { kind: 'obj', get: () => get() })
  }
  fn('Range', (args, named) => obj(st.makeRange(rangeArgs(st, args, named))))
  fn('Cells', (args, named) => obj(sheetCells(st, args, named)))
  fn('Rows', (args, named) => obj(sheetRows(st, args, named)))
  fn('Columns', (args, named) => obj(sheetColumns(st, args, named)))
  fn('Worksheets', (args, named) => sheetsGlobal(st, args, named))
  fn('Sheets', (args, named) => sheetsGlobal(st, args, named))
  fn('Evaluate', (args) => evaluateText(st, toStr(args[0] ?? { t: 'empty' })))
  fn('Intersect', (args) => intersect(st, args))
  fn('Union', (args) => union(st, args))
  fn('Calculate', () => {
    host.recalc()
    return { t: 'empty' }
  }, true)
  object('ActiveCell', () => activeCell(st))
  object('Selection', () => selectionRange(st))
  object('ActiveSheet', () => st.worksheet())
  object('Application', application)
  object('ThisWorkbook', () => (book ??= makeWorkbook(st)))
  fn('Workbooks', (args, named) => workbooksGlobal(() => (book ??= makeWorkbook(st)), args, named))
  // Me: the code pane also plays the sheet's own module (event tasks), where Me is the worksheet
  object('Me', () => st.worksheet())
  object('ActiveWorkbook', () => (book ??= makeWorkbook(st)))
  object('WorksheetFunction', () => worksheetFunctionObject(st))
  const win = activeWindow()
  object('ActiveWindow', () => win)
  for (const [name, value] of Object.entries(XL_CONSTANTS)) scope.set(name.toLowerCase(), { kind: 'const', value: lng(value) })
  return scope
}
