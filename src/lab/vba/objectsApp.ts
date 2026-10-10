// objectsApp.ts - sheet-level members (Cells, Rows, Columns, ActiveCell, Selection), the one Worksheet, the Sheets
// collection, the Workbook and Application (settings, InputBox, Wait, Intersect, Union, WorksheetFunction).
import { bool, dbl, EMPTY, lng, NOTHING, obj, own, str, VbaError } from './runtime'
import type { Val, VbaObject } from './runtime'
import { parseNumber, toDate, toNumber, toStr } from './coerce'
import { appError, arg, areasOf, boxText, filled, lower, num, parseAddress, text } from './objectsCore'
import type { Box, XlState } from './objectsCore'
import { intersectAreas, itemBox, rangeArgs, rangeList } from './objectsNav'
import { moveBlock, pasteBlock } from './objectsPaste'
import { makeObject } from './objectsFormat'
import { evaluateText, excelName, worksheetFunction, worksheetFunctionObject } from './objectsWsf'

export const sheetBox = (st: XlState): Box => ({ r1: 1, c1: 1, r2: st.host.rows, c2: st.host.cols })

export function sheetCells(st: XlState, args: Val[], named: Record<string, Val>): VbaObject {
  if (!args.length && !Object.keys(named).length) return st.makeRange([sheetBox(st)], 'cells')
  return st.makeRange([itemBox(st, sheetBox(st), 'cells', args, named)], 'cells')
}

function lines(st: XlState, kind: 'rows' | 'cols', args: Val[], named: Record<string, Val>): VbaObject {
  const whole = sheetBox(st)
  if (!args.length) return st.makeRange([whole], kind, kind)
  const a = args[0]
  if (a.t === 'str' && (a.v.includes(':') || kind === 'cols')) {
    const spec = a.v.includes(':') ? a.v : `${a.v}:${a.v}`
    const parsed = parseAddress(spec, st.host)
    if (!parsed) throw new VbaError(1004, `${kind === 'rows' ? 'Rows' : 'Columns'}("${a.v}") is not a valid reference`)
    return st.makeRange(parsed, kind, kind)
  }
  return st.makeRange([itemBox(st, whole, kind, args, named)], kind, kind)
}

export const sheetRows = (st: XlState, args: Val[], named: Record<string, Val>): VbaObject => lines(st, 'rows', args, named)
export const sheetColumns = (st: XlState, args: Val[], named: Record<string, Val>): VbaObject => lines(st, 'cols', args, named)

function boxesOf(st: XlState, range: string): Box[] {
  return parseAddress(range, st.host) ?? [{ r1: 1, c1: 1, r2: 1, c2: 1 }]
}

export const selectionRange = (st: XlState): VbaObject => st.makeRange(boxesOf(st, st.host.selection().range))
export const activeCell = (st: XlState): VbaObject => st.makeRange(boxesOf(st, st.host.selection().active).slice(0, 1))

export function intersect(st: XlState, args: Val[]): Val {
  const areas = intersectAreas(rangeList(args))
  return areas ? obj(st.makeRange(areas)) : NOTHING
}

export function union(st: XlState, args: Val[]): Val {
  const lists = rangeList(args)
  if (!lists.length) throw new VbaError(449)
  return obj(st.makeRange(lists.flat()))
}

function usedRange(st: XlState): Box {
  let box: Box | null = null
  for (let r = 1; r <= st.host.rows; r++) {
    for (let c = 1; c <= st.host.cols; c++) {
      if (!filled(st.host, r, c)) continue
      box = box ? { r1: Math.min(box.r1, r), c1: Math.min(box.c1, c), r2: Math.max(box.r2, r), c2: Math.max(box.c2, c) } : { r1: r, c1: c, r2: r, c2: c }
    }
  }
  return box ?? { r1: 1, c1: 1, r2: 1, c2: 1 }
}

function worksheetPaste(st: XlState, args: Val[], named: Record<string, Val>): Val {
  if (!st.clip) throw new VbaError(1004, 'Paste method of Worksheet class failed: nothing has been copied')
  const d = arg(args, named, 0, 'Destination')
  const dest = d && d.t === 'obj' ? areasOf(d.v)?.[0] : boxesOf(st, st.host.selection().range)[0]
  if (!dest) throw new VbaError(424)
  // a Cut moves once and empties the clipboard, as in Excel
  const pasted = st.clipCut ? moveBlock(st, st.clip, dest) : pasteBlock(st, st.clip, dest)
  if (st.clipCut) {
    st.clip = null
    st.clipCut = false
  }
  st.host.select(boxText(pasted), boxText({ r1: pasted.r1, c1: pasted.c1, r2: pasted.r1, c2: pasted.c1 }))
  return bool(true)
}

export function makeWorksheet(st: XlState, workbook: () => VbaObject): VbaObject {
  const sheet: VbaObject = makeObject('Worksheet', {
    name: () => str(st.host.sheetName),
    codename: () => str('Sheet1'),
    index: () => lng(1),
    type: () => lng(-4167),
    range: (a, n) => obj(st.makeRange(rangeArgs(st, a, n))),
    cells: (a, n) => obj(sheetCells(st, a, n)),
    rows: (a, n) => obj(sheetRows(st, a, n)),
    columns: (a, n) => obj(sheetColumns(st, a, n)),
    usedrange: () => obj(st.makeRange([usedRange(st)])),
    evaluate: (a, n) => evaluateText(st, toStr(arg(a, n, 0, 'Name') ?? EMPTY)),
    activate: () => bool(true),
    select: () => bool(true),
    calculate: () => { st.host.recalc(); return bool(true) },
    parent: () => obj(workbook()),
    visible: () => lng(-1),
    protect: () => bool(true),
    unprotect: () => bool(true),
    protectcontents: () => bool(true),
    paste: (a, n) => worksheetPaste(st, a, n),
    next: () => NOTHING,
    previous: () => NOTHING,
  }, {
    name: () => { throw appError('the lab sheet cannot be renamed') },
    visible: (v) => {
      if (toNumber(v) !== -1 && !(v.t === 'bool' && v.v)) throw appError("the lab's only sheet must stay visible")
    },
  }, { sameAs: (o) => o === sheet })
  return sheet
}

/** Worksheets / Sheets: one sheet, by index 1 or by its name; anything else is error 9 */
export function makeSheets(st: XlState): VbaObject {
  const check = (v: Val): void => {
    const ok = v.t === 'str' ? lower(v.v.trim()) === lower(st.host.sheetName) : toNumber(v) === 1
    if (!ok) throw new VbaError(9, `Subscript out of range: the lab workbook has one sheet, "${st.host.sheetName}"`)
  }
  // Sheets("Data") or Sheets(1) is the sheet; Sheets(Array("Data")) is a collection of the named sheets
  const pick = (v: Val | undefined): Val => {
    if (!v) throw new VbaError(449)
    if (v.t === 'arr') {
      v.v.data.forEach(check)
      return obj(sheets)
    }
    check(v)
    return obj(st.worksheet())
  }
  const sheets: VbaObject = makeObject('Sheets', {
    count: () => lng(1),
    item: (a, n) => pick(arg(a, n, 0, 'Index')),
    add: () => { throw appError('the lab workbook has one sheet; Sheets.Add is not available') },
    select: () => bool(true),
  }, {}, {
    defaultGet: (a) => (a.length ? pick(a[0]) : obj(sheets)),
    enumerate: () => [obj(st.worksheet())],
  })
  return sheets
}

export function sheetsGlobal(st: XlState, args: Val[], named: Record<string, Val>): Val {
  const sheets = makeSheets(st)
  return args.length || Object.keys(named).length ? sheets.get('Item', args, named) : obj(sheets)
}

/** Workbooks: the lab has one workbook, ThisWorkbook; any other name is error 9, Open/Add are 1004 */
export function workbooksGlobal(workbook: () => VbaObject, args: Val[], named: Record<string, Val>): Val {
  const pick = (v: Val | undefined): Val => {
    if (!v) throw new VbaError(449)
    const name = v.t === 'str' ? lower(v.v.trim()) : ''
    const ok = v.t === 'str' ? name === 'excellab.xlsm' || name === 'excellab' : toNumber(v) === 1
    if (!ok) throw new VbaError(9, `Subscript out of range: the lab has one workbook, ExcelLab.xlsm (ThisWorkbook)`)
    return obj(workbook())
  }
  const books: VbaObject = makeObject('Workbooks', {
    count: () => lng(1),
    item: (a, n) => pick(arg(a, n, 0, 'Index')),
    open: () => { throw appError('the lab has one workbook; Workbooks.Open is not available') },
    add: () => { throw appError('the lab has one workbook; Workbooks.Add is not available') },
  }, {}, {
    defaultGet: (a) => (a.length ? pick(a[0]) : obj(books)),
    enumerate: () => [obj(workbook())],
  })
  return args.length || Object.keys(named).length ? books.get('Item', args, named) : obj(books)
}

export function makeWorkbook(st: XlState): VbaObject {
  const wb: VbaObject = makeObject('Workbook', {
    name: () => str('ExcelLab.xlsm'),
    fullname: () => str('ExcelLab.xlsm'),
    path: () => str(''),
    worksheets: (a, n) => sheetsGlobal(st, a, n),
    sheets: (a, n) => sheetsGlobal(st, a, n),
    activesheet: () => obj(st.worksheet()),
    save: () => bool(true),
    saved: () => bool(true),
    activate: () => bool(true),
  }, { saved: () => undefined }, { sameAs: (o) => o.className === 'Workbook' })
  return wb
}

// Application.InputBox(Prompt, Title, Default, Left, Top, HelpFile, HelpContextID, Type): False on Cancel
function appInputBox(st: XlState, args: Val[], named: Record<string, Val>): Val {
  const prompt = toStr(arg(args, named, 0, 'Prompt') ?? EMPTY)
  const title = toStr(arg(args, named, 1, 'Title') ?? str('Input'))
  const def = toStr(arg(args, named, 2, 'Default') ?? EMPTY)
  const type = num(arg(args, named, 7, 'Type'), 2)
  for (let tries = 0; tries < 20; tries++) {
    const reply = st.host.inputBox(prompt, title, def)
    if (reply === null || reply === '') return bool(false)
    if (type & 8) {
      const boxes = parseAddress(reply.replace(/^=/, ''), st.host)
      if (boxes) return obj(st.makeRange(boxes))
      continue
    }
    if (type & 1) {
      const n = parseNumber(reply.replace(/^=/, ''))
      if (n !== null) return dbl(n)
      if (!(type & 2)) continue // Excel: "Number is not valid", asks again
    }
    if (type & 4) {
      if (/^(true|false)$/i.test(reply.trim())) return bool(/^true$/i.test(reply.trim()))
      if (!(type & 2)) continue
    }
    return str(reply)
  }
  return bool(false)
}

const SETTINGS: Record<string, Val> = {
  screenupdating: bool(true), enableevents: bool(true), displayalerts: bool(true), statusbar: bool(false),
  calculation: lng(-4105), displaystatusbar: bool(true), interactive: bool(true), cursor: lng(-4143),
  enablecancelkey: lng(1), windowstate: lng(-4137), displayfullscreen: bool(false),
}

export function makeApplication(st: XlState, workbook: () => VbaObject): VbaObject {
  const get: Record<string, (args: Val[], named: Record<string, Val>) => Val> = {
    activecell: () => obj(activeCell(st)),
    selection: () => obj(selectionRange(st)),
    activesheet: () => obj(st.worksheet()),
    activeworkbook: () => obj(workbook()),
    thisworkbook: () => obj(workbook()),
    workbooks: (a, n) => workbooksGlobal(workbook, a, n),
    worksheets: (a, n) => sheetsGlobal(st, a, n),
    sheets: (a, n) => sheetsGlobal(st, a, n),
    range: (a, n) => obj(st.makeRange(rangeArgs(st, a, n))),
    cells: (a, n) => obj(sheetCells(st, a, n)),
    rows: (a, n) => obj(sheetRows(st, a, n)),
    columns: (a, n) => obj(sheetColumns(st, a, n)),
    worksheetfunction: () => obj(worksheetFunctionObject(st)),
    evaluate: (a, n) => evaluateText(st, toStr(arg(a, n, 0, 'Name') ?? EMPTY)),
    intersect: (a) => intersect(st, a),
    union: (a) => union(st, a),
    calculate: () => { st.host.recalc(); return bool(true) },
    calculatefull: () => { st.host.recalc(); return bool(true) },
    inputbox: (a, n) => appInputBox(st, a, n),
    wait: (a, n) => {
      const t = arg(a, n, 0, 'Time')
      if (!t) throw new VbaError(449)
      const target = toDate(t)
      if (target > st.host.now()) st.extras.setNow?.(target)
      return bool(true)
    },
    volatile: () => EMPTY,
    goto: (a, n) => {
      const ref = arg(a, n, 0, 'Reference')
      const boxes = ref?.t === 'obj' ? areasOf(ref.v) : ref ? parseAddress(text(ref), st.host) : null
      if (boxes) st.makeRange(boxes).call('Select', [], {})
      return EMPTY
    },
    name: () => str('Microsoft Excel'),
    version: () => str('16.0'),
    username: () => str('Learner'),
    cutcopymode: () => (st.clip ? lng(st.clipCut ? 2 : 1) : bool(false)),
  }
  const app: VbaObject = {
    className: 'Application',
    get(name, args, named) {
      const key = lower(name)
      const f = own(get, key)
      if (f) return f(args, named)
      const setting = own(SETTINGS, key)
      if (setting) return st.app.get(key) ?? setting
      if (st.extras.knowsFunction?.(excelName(name))) return worksheetFunction(st, name, args, false)
      throw new VbaError(438, `Object doesn't support this property or method: Application.${name}`)
    },
    call(name, args, named) { return app.get(name, args, named) },
    set(name, _args, value) {
      const key = lower(name)
      if (key === 'cutcopymode') {
        if (value.t === 'bool' ? !value.v : toNumber(value) === 0) st.clip = null
        return
      }
      if (own(SETTINGS, key)) {
        st.app.set(key, value)
        return
      }
      throw new VbaError(438, `Object doesn't support this property or method: Application.${name}`)
    },
    sameAs: (o) => o === app,
  }
  return app
}
