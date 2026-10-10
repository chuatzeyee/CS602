// vbaLibrary(): VBA's own functions, the vb... constants and the Err object (lookup step 4, after excelScope).
import { deref, toStr } from './coerce'
import { EMPTY, VbaError, int, lng, str, type BuiltinFn, type GlobalScope, type RunCtx, type VbaObject } from './runtime'
import { fn, konst, need, opt, optWhole, whole, type Table } from './builtinsArgs'
import { arrayFunctions } from './builtinsArray'
import { dateFunctions } from './builtinsDate'
import { formatFunctions } from './builtinsFormat'
import { mathFunctions } from './builtinsMath'
import { stringFunctions } from './builtinsString'
import { objectFunctions } from './builtinsCollection'

function errObject(ctx: RunCtx): VbaObject {
  const e = ctx.err
  const obj: VbaObject = {
    className: 'ErrObject',
    get(name, args, named) {
      switch (name.toLowerCase()) {
        case 'number': return lng(e.number)
        case 'description': return str(e.description)
        case 'source': return str(e.source)
        case 'helpfile': return str('')
        case 'helpcontext': case 'lastdllerror': return lng(0)
        case 'clear': case 'raise': return obj.call(name, args, named)
        default: throw new VbaError(438)
      }
    },
    set(name, _args, value) {
      switch (name.toLowerCase()) {
        case 'number': e.number = whole(value); break
        case 'description': e.description = toStr(value); break
        case 'source': e.source = toStr(value); break
        default: throw new VbaError(438)
      }
    },
    call(name, args, named) {
      switch (name.toLowerCase()) {
        case 'clear':
          e.number = 0
          e.description = ''
          e.source = ''
          return EMPTY
        case 'raise': {
          const n = whole(need(args, named, 0, 'Number'))
          const desc = opt(args, named, 2, 'Description')
          throw new VbaError(n, desc !== undefined ? toStr(desc) : undefined)
        }
        default: return obj.get(name, args, named)
      }
    },
    defaultGet: () => lng(e.number),
  }
  return obj
}

const msgBoxFn: BuiltinFn = (ctx, a, n) => {
  const prompt = toStr(deref(need(a, n, 0, 'Prompt')))
  const buttons = optWhole(opt(a, n, 1, 'Buttons'), 0)
  const t = opt(a, n, 2, 'Title')
  return lng(ctx.host.msgBox(prompt, buttons, t === undefined ? 'Microsoft Excel' : toStr(t)))
}

const inputBoxFn: BuiltinFn = (ctx, a, n) => {
  const prompt = toStr(deref(need(a, n, 0, 'Prompt')))
  const t = opt(a, n, 1, 'Title')
  const d = opt(a, n, 2, 'Default')
  const reply = ctx.host.inputBox(prompt, t === undefined ? 'Microsoft Excel' : toStr(t), d === undefined ? '' : toStr(d))
  return str(reply ?? '')
}

const strConvFn: BuiltinFn = (_c, a, n) => {
  const s = toStr(need(a, n, 0, 'String'))
  switch (whole(need(a, n, 1, 'Conversion'))) {
    case 1: return str(s.toUpperCase())
    case 2: return str(s.toLowerCase())
    case 3: return str(s.toLowerCase().replace(/(^|[^A-Za-z'])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase()))
    default: return str(s)
  }
}

const errorFn: BuiltinFn = (ctx, a, n) => {
  const v = opt(a, n, 0, 'ErrorNumber')
  if (v === undefined) return str(ctx.err.description)
  const k = whole(v)
  return str(k === 0 ? '' : new VbaError(k).description)
}

// Debug.Print / Debug.Assert when they reach the library as member calls (the parser normally makes a print statement)
function debugObject(ctx: RunCtx): VbaObject {
  const self: VbaObject = {
    className: 'Debug',
    get(name, args, named) { return self.call(name, args, named) },
    set() { throw new VbaError(438) },
    call(name, args) {
      const key = name.toLowerCase()
      if (key === 'print') {
        ctx.host.print(args.map(v => toStr(deref(v))).join(''))
        return EMPTY
      }
      if (key === 'assert') return EMPTY
      throw new VbaError(438)
    },
  }
  return self
}

function ioFunctions(): Table {
  return [
    ['msgbox', fn(msgBoxFn, true)],
    ['inputbox', fn(inputBoxFn, true)],
    ['strconv', fn(strConvFn)],
    ['error', fn(errorFn)],
    ['error$', fn(errorFn)],
    ['doevents', fn(() => int(0), true)],
    ['beep', fn(() => EMPTY, true)],
    ['err', { kind: 'obj', get: errObject }],
    ['debug', { kind: 'obj', get: debugObject }],
  ]
}

const LONG_CONSTANTS: Record<string, number> = {
  vbOKOnly: 0, vbOKCancel: 1, vbAbortRetryIgnore: 2, vbYesNoCancel: 3, vbYesNo: 4, vbRetryCancel: 5,
  vbCritical: 16, vbQuestion: 32, vbExclamation: 48, vbInformation: 64,
  vbDefaultButton1: 0, vbDefaultButton2: 256, vbDefaultButton3: 512, vbDefaultButton4: 768,
  vbApplicationModal: 0, vbSystemModal: 4096, vbMsgBoxHelpButton: 16384, vbMsgBoxSetForeground: 65536,
  vbMsgBoxRight: 524288, vbMsgBoxRtlReading: 1048576,
  vbOK: 1, vbCancel: 2, vbAbort: 3, vbRetry: 4, vbIgnore: 5, vbYes: 6, vbNo: 7,
  vbBlack: 0, vbRed: 255, vbGreen: 65280, vbYellow: 65535, vbBlue: 16711680, vbMagenta: 16711935,
  vbCyan: 16776960, vbWhite: 16777215,
  vbUseSystemDayOfWeek: 0, vbSunday: 1, vbMonday: 2, vbTuesday: 3, vbWednesday: 4, vbThursday: 5, vbFriday: 6,
  vbSaturday: 7, vbUseSystem: 0, vbFirstJan1: 1, vbFirstFourDays: 2, vbFirstFullWeek: 3,
  vbBinaryCompare: 0, vbTextCompare: 1, vbDatabaseCompare: 2,
  vbEmpty: 0, vbNull: 1, vbInteger: 2, vbLong: 3, vbSingle: 4, vbDouble: 5, vbCurrency: 6, vbDate: 7, vbString: 8,
  vbObject: 9, vbError: 10, vbBoolean: 11, vbVariant: 12, vbDataObject: 13, vbDecimal: 14, vbByte: 17, vbArray: 8192,
  vbUpperCase: 1, vbLowerCase: 2, vbProperCase: 3,
  vbGeneralDate: 0, vbLongDate: 1, vbShortDate: 2, vbLongTime: 3, vbShortTime: 4,
  vbTrue: -1, vbFalse: 0, vbUseDefault: -2, vbObjectError: -2147221504,
}

const STRING_CONSTANTS: Record<string, string> = {
  vbCrLf: '\r\n', vbNewLine: '\r\n', vbCr: '\r', vbLf: '\n', vbTab: '\t', vbNullString: '', vbNullChar: '\0',
  vbBack: '\b', vbFormFeed: '\f', vbVerticalTab: '\v',
}

function constants(): Table {
  const t: Table = []
  for (const [k, v] of Object.entries(LONG_CONSTANTS)) t.push([k.toLowerCase(), konst(lng(v))])
  for (const [k, v] of Object.entries(STRING_CONSTANTS)) t.push([k.toLowerCase(), konst(str(v))])
  return t
}

let library: GlobalScope | null = null

export function vbaLibrary(): GlobalScope {
  if (!library) {
    library = new Map([
      ...stringFunctions(), ...mathFunctions(), ...dateFunctions(), ...formatFunctions(), ...arrayFunctions(),
      ...ioFunctions(), ...constants(), ...objectFunctions(),
    ])
  }
  return library
}

