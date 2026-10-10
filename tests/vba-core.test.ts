import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bankersRound, binary, coerceTo, compare, formatNumber, isNumeric, likeMatch, parseNumber, toBool, toDate, toNumber,
  toStr, typeName, unary,
} from '../src/lab/vba/coerce.ts'
import { EMPTY, NULL_VAL, VbaError, bool, dbl, int, lng, str, type Val } from '../src/lab/vba/runtime.ts'

const ctx = { compareText: false }
const typed = { compareText: false, lVariant: false, rVariant: false }
const errNo = (fn: () => unknown): number => {
  try { fn() } catch (e) { if (e instanceof VbaError) return e.number; throw e }
  return 0
}

// ---------- coercion ----------

test('coerce: numeric strings incl. spaces, exponent, thousands, hex', () => {
  assert.equal(toNumber(str(' 12 ')), 12)
  assert.equal(toNumber(str('1e3')), 1000)
  assert.equal(toNumber(str('1,234.5')), 1234.5)
  assert.equal(toNumber(str('&H10')), 16)
  assert.equal(toNumber(str('.5')), 0.5)
  assert.equal(toNumber(str('-3')), -3)
  assert.equal(parseNumber('abc'), null)
  assert.equal(parseNumber(''), null)
  assert.equal(parseNumber('Infinity'), null)
  assert.equal(errNo(() => toNumber(str('12abc'))), 13)
  assert.equal(errNo(() => toNumber(str(''))), 13)
})

test('coerce: Empty, Boolean, Null', () => {
  assert.equal(toNumber(EMPTY), 0)
  assert.equal(toStr(EMPTY), '')
  assert.equal(toNumber(bool(true)), -1)
  assert.equal(toStr(bool(true)), 'True')
  assert.equal(toStr(bool(false)), 'False')
  assert.equal(toBool(str('true')), true)
  assert.equal(toBool(str('0')), false)
  assert.equal(toBool(dbl(0.1)), true)
  assert.equal(errNo(() => toBool(str('yes'))), 13)
  assert.equal(errNo(() => toNumber(NULL_VAL)), 94)
})

test('coerce: Integer and Long overflow is error 6, banker rounding on the way in', () => {
  assert.deepEqual(coerceTo(dbl(2.5), 'Integer'), int(2))
  assert.deepEqual(coerceTo(dbl(3.5), 'Integer'), int(4))
  assert.deepEqual(coerceTo(dbl(-2.5), 'Integer'), int(-2))
  assert.deepEqual(coerceTo(str('12.7'), 'Integer'), int(13))
  assert.equal(errNo(() => coerceTo(lng(32768), 'Integer')), 6)
  assert.equal(errNo(() => coerceTo(dbl(2147483648), 'Long')), 6)
  assert.deepEqual(coerceTo(dbl(-32768), 'Integer'), int(-32768))
  assert.equal(errNo(() => coerceTo(str('abc'), 'Long')), 13)
  assert.equal(errNo(() => coerceTo(dbl(256), 'Byte')), 6)
  assert.deepEqual(coerceTo(bool(true), 'Integer'), int(-1))
  assert.deepEqual(coerceTo(EMPTY, 'Long'), lng(0))
})

test('coerce: String, Boolean, Single, Currency, Date targets', () => {
  assert.deepEqual(coerceTo(int(5), 'String'), str('5'))
  assert.deepEqual(coerceTo(dbl(0.1 + 0.2), 'String'), str('0.3'))
  assert.deepEqual(coerceTo(str('False'), 'Boolean'), bool(false))
  assert.deepEqual(coerceTo(int(2), 'Boolean'), bool(true))
  assert.equal(toStr(coerceTo(dbl(0.1), 'Single')), '0.1')
  assert.equal(toStr(coerceTo(dbl(1 / 3), 'Single')), '0.3333333')
  assert.deepEqual(coerceTo(dbl(1.23456), 'Currency'), { t: 'currency', v: 1.2346 })
  assert.equal(coerceTo(str('2026-01-02'), 'Date').t, 'date')
  assert.equal(errNo(() => coerceTo({ t: 'err', v: 2042 }, 'String')), 13)
})

test('CStr: 15 significant digits and scientific forms', () => {
  assert.equal(formatNumber(1 / 3), '0.333333333333333')
  assert.equal(formatNumber(123456789012345), '123456789012345')
  assert.equal(formatNumber(1e15), '1E+15')
  assert.equal(formatNumber(1.5e20), '1.5E+20')
  assert.equal(formatNumber(0.0001), '0.0001')
  assert.equal(formatNumber(0.00001), '1E-05')
  assert.equal(formatNumber(-2.5), '-2.5')
  assert.equal(formatNumber(100), '100')
  assert.equal(toStr(dbl(2 / 3)), '0.666666666666667')
})

test('CStr: dates use the short date and long time', () => {
  const d = toDate(str('2026-01-02'))
  assert.equal(toStr({ t: 'date', v: d }), '02/01/2026')
  assert.equal(toStr({ t: 'date', v: d + 13.5 / 24 }), '02/01/2026 1:30:00 PM')
  assert.equal(toStr({ t: 'date', v: 0.25 }), '6:00:00 AM')
  assert.equal(toDate(str('10/10/2026')), toDate(str('2026-10-10')))
  assert.equal(toDate(str('13/1/2026')), toDate(str('2026-01-13')))
  assert.equal(toDate(str('1/13/2026')), toDate(str('2026-01-13')))
  assert.equal(toDate(str('2 Jan 2026')), d)
  assert.equal(toDate(str('January 2, 2026')), d)
  assert.equal(toDate(str('13:30')), 13.5 / 24)
  assert.equal(toDate(str('1:30 PM')), 13.5 / 24)
  assert.equal(errNo(() => toDate(str('not a date'))), 13)
})

test('typeName and isNumeric', () => {
  assert.equal(typeName(int(1)), 'Integer')
  assert.equal(typeName(EMPTY), 'Empty')
  assert.equal(typeName(str('x')), 'String')
  assert.equal(typeName({ t: 'obj', v: null }), 'Nothing')
  assert.equal(typeName({ t: 'arr', v: { dims: [], data: [], elemType: 'Variant', fixed: false } }), 'Variant()')
  assert.equal(isNumeric(str(' 12 ')), true)
  assert.equal(isNumeric(str('')), false)
  assert.equal(isNumeric(EMPTY), true)
  assert.equal(isNumeric(str('1e3')), true)
  assert.equal(isNumeric({ t: 'date', v: 1 }), false)
})

// ---------- operators ----------

test('operators: + with strings and numbers', () => {
  assert.deepEqual(binary('+', str('5'), int(3), ctx), dbl(8))
  assert.deepEqual(binary('+', str('5'), str('3'), ctx), str('53'))
  assert.deepEqual(binary('&', str('5'), int(3), ctx), str('53'))
  assert.equal(errNo(() => binary('+', str('a'), int(1), ctx)), 13)
  assert.deepEqual(binary('+', EMPTY, str('x'), ctx), str('x'))
  assert.deepEqual(binary('+', EMPTY, EMPTY, ctx), int(0))
  assert.deepEqual(binary('&', NULL_VAL, str('a'), ctx), str('a'))
  assert.deepEqual(binary('&', dbl(1.5), bool(true), ctx), str('1.5True'))
})

test('operators: Integer overflow is error 6 when typed, widens when Variant', () => {
  assert.equal(errNo(() => binary('*', int(200), int(200), typed)), 6)
  assert.equal(errNo(() => binary('+', int(32767), int(1), typed)), 6)
  assert.deepEqual(binary('*', int(200), int(200), ctx), lng(40000))
  assert.deepEqual(binary('+', int(1), int(2), typed), int(3))
  assert.deepEqual(binary('+', int(1), lng(2), typed), lng(3))
  assert.deepEqual(binary('+', int(1), dbl(0.5), typed), dbl(1.5))
  assert.deepEqual(binary('+', bool(true), bool(true), typed), int(-2))
  assert.equal(errNo(() => binary('*', lng(2147483647), int(2), typed)), 6)
  assert.deepEqual(binary('*', lng(2147483647), int(2), ctx), dbl(4294967294))
})

test('operators: / is Double, \\ and Mod round first, ^', () => {
  assert.deepEqual(binary('/', int(7), int(2), typed), dbl(3.5))
  assert.deepEqual(binary('/', int(1), int(3), typed), dbl(1 / 3))
  assert.deepEqual(binary('\\', dbl(7.5), int(2), typed), lng(4))
  assert.deepEqual(binary('\\', int(7), int(2), typed), int(3))
  assert.deepEqual(binary('mod', dbl(5.5), int(2), typed), lng(0))
  assert.deepEqual(binary('mod', int(-7), int(3), typed), int(-1))
  assert.deepEqual(binary('mod', dbl(6.5), int(4), typed), lng(2))
  assert.equal(errNo(() => binary('/', int(1), int(0), typed)), 11)
  assert.equal(errNo(() => binary('/', int(0), int(0), typed)), 6)
  assert.equal(errNo(() => binary('mod', int(1), int(0), typed)), 11)
  assert.deepEqual(binary('^', int(2), int(10), typed), dbl(1024))
  assert.equal(errNo(() => binary('^', int(-8), dbl(1 / 3), typed)), 5)
})

test('operators: Null propagates', () => {
  assert.deepEqual(binary('+', NULL_VAL, int(1), ctx), NULL_VAL)
  assert.deepEqual(binary('=', NULL_VAL, int(1), ctx), NULL_VAL)
  assert.deepEqual(binary('and', NULL_VAL, bool(false), ctx), bool(false))
  assert.deepEqual(binary('and', NULL_VAL, bool(true), ctx), NULL_VAL)
  assert.deepEqual(binary('or', NULL_VAL, bool(true), ctx), bool(true))
  assert.deepEqual(unary('not', NULL_VAL), NULL_VAL)
  assert.deepEqual(unary('-', NULL_VAL), NULL_VAL)
})

test('operators: logical and bitwise', () => {
  assert.deepEqual(binary('and', bool(true), bool(false), ctx), bool(false))
  assert.deepEqual(binary('or', bool(true), bool(false), ctx), bool(true))
  assert.deepEqual(binary('xor', bool(true), bool(true), ctx), bool(false))
  assert.deepEqual(binary('and', int(5), int(3), ctx), int(1))
  assert.deepEqual(binary('or', int(5), int(3), ctx), int(7))
  assert.deepEqual(unary('not', bool(true)), bool(false))
  assert.deepEqual(unary('not', int(0)), int(-1))
  assert.deepEqual(binary('imp', bool(true), bool(false), ctx), bool(false))
  assert.deepEqual(binary('eqv', bool(false), bool(false), ctx), bool(true))
  assert.deepEqual(unary('-', int(5)), int(-5))
  assert.deepEqual(unary('-', str('5')), dbl(-5))
})

test('compare: numbers, numeric strings and strings', () => {
  // typed number vs Variant numeric string: numeric
  assert.equal(compare(int(10), str('9'), false, false, true), 1)
  // typed string vs Variant number: text
  assert.equal(compare(dbl(10), str('9'), false, true, false), -1)
  // two Variants: number < string
  assert.equal(compare(dbl(10), str('9'), false, true, true), -1)
  assert.equal(compare(str('5'), dbl(5), false, true, true), 1)
  // typed number vs non-numeric string: type mismatch
  assert.equal(errNo(() => compare(int(1), str('abc'), false, false, true)), 13)
  // strings, binary vs text
  assert.equal(compare(str('a'), str('B'), false), 1)
  assert.equal(compare(str('a'), str('B'), true), -1)
  assert.equal(compare(str('abc'), str('ABC'), true), 0)
  // Empty
  assert.equal(compare(EMPTY, str(''), false), 0)
  assert.equal(compare(EMPTY, int(0), false), 0)
  assert.equal(compare(NULL_VAL, int(0), false), null)
  assert.deepEqual(binary('<>', EMPTY, str(''), typed), bool(false))
  assert.deepEqual(binary('=', bool(true), int(-1), typed), bool(true))
})

test('Like patterns', () => {
  assert.equal(likeMatch('Smith', 'S*', false), true)
  assert.equal(likeMatch('smith', 'S*', false), false)
  assert.equal(likeMatch('smith', 'S*', true), true)
  assert.equal(likeMatch('BAT', 'B?T', false), true)
  assert.equal(likeMatch('a1b', 'a#b', false), true)
  assert.equal(likeMatch('axb', 'a#b', false), false)
  assert.equal(likeMatch('F', '[A-F]', false), true)
  assert.equal(likeMatch('G', '[A-F]', false), false)
  assert.equal(likeMatch('d', '[!a-c]', false), true)
  assert.equal(likeMatch('b', '[!a-c]', false), false)
  assert.equal(likeMatch('a*b', 'a[*]b', false), true)
  assert.equal(likeMatch('PK-411', 'PK-###', false), true)
  assert.equal(likeMatch('x.y', 'x.y', false), true)
  assert.equal(likeMatch('xzy', 'x.y', false), false)
  assert.deepEqual(binary('like', str('abc'), str('a*'), ctx), bool(true))
})

test('banker rounding', () => {
  assert.equal(bankersRound(2.5), 2)
  assert.equal(bankersRound(3.5), 4)
  assert.equal(bankersRound(-2.5), -2)
  assert.equal(bankersRound(0.125, 2), 0.12)
  assert.equal(bankersRound(0.135, 2), 0.14)
  assert.equal(bankersRound(2.675, 2), 2.68)
  assert.equal(bankersRound(1.2345, 3), 1.234)
  assert.equal(bankersRound(7.1), 7)
})


test('operators: dates and currency', () => {
  const d: Val = { t: 'date', v: 46297 }
  assert.deepEqual(binary('+', d, int(1), typed), { t: 'date', v: 46298 })
  assert.deepEqual(binary('-', d, { t: 'date', v: 46290 }, typed), dbl(7))
  assert.deepEqual(binary('-', d, int(1), typed), { t: 'date', v: 46296 })
  assert.deepEqual(binary('*', { t: 'currency', v: 1.5 }, int(3), typed), { t: 'currency', v: 4.5 })
  assert.deepEqual(binary('+', { t: 'currency', v: 0.00005 }, { t: 'currency', v: 0 }, typed), { t: 'currency', v: 0 })
})

test('operators: Byte and unary overflow, string arithmetic', () => {
  const byte = (v: number): Val => ({ t: 'byte', v })
  assert.equal(errNo(() => binary('+', byte(200), byte(100), typed)), 6)
  assert.deepEqual(binary('+', byte(200), byte(100), ctx), int(300))
  assert.equal(errNo(() => unary('-', int(-32768), false)), 6)
  assert.deepEqual(unary('-', int(-32768), true), lng(32768))
  assert.deepEqual(binary('*', str('3'), str('4'), ctx), dbl(12))
  assert.deepEqual(binary('-', str('10'), str('4'), ctx), dbl(6))
  assert.deepEqual(binary('\\', str('7'), int(2), ctx), lng(3))
  assert.deepEqual(binary('&', NULL_VAL, NULL_VAL, ctx), NULL_VAL)
  assert.equal(errNo(() => binary('&', str('x'), { t: 'err', v: 2042 }, ctx)), 13)
})

test('compare: errors, Booleans, dates', () => {
  assert.equal(errNo(() => compare({ t: 'err', v: 2042 }, str('x'), false)), 13)
  assert.equal(compare(bool(true), int(-1), false, false, false), 0)
  assert.equal(compare(bool(true), bool(false), false), -1)
  assert.equal(compare({ t: 'date', v: 2 }, int(1), false), 1)
  assert.deepEqual(binary('=', bool(true), str('True'), { compareText: false, lVariant: true, rVariant: false }), bool(true))
})

test('coerce: objects use their default member; Nothing is error 91', () => {
  const cell = { className: 'Range', get: () => EMPTY, set: () => undefined, call: () => EMPTY, defaultGet: () => dbl(4) }
  const o: Val = { t: 'obj', v: cell }
  assert.equal(toNumber(o), 4)
  assert.equal(toStr(o), '4')
  assert.deepEqual(binary('+', o, int(1), ctx), dbl(5))
  assert.equal(typeName(o), 'Range')
  assert.equal(errNo(() => toNumber({ t: 'obj', v: null })), 91)
  const noDefault: Val = { t: 'obj', v: { className: 'Worksheet', get: () => EMPTY, set: () => undefined, call: () => EMPTY } }
  assert.equal(errNo(() => toStr(noDefault)), 438)
  assert.deepEqual(binary('is', o, o, ctx), bool(true))
  assert.deepEqual(binary('is', { t: 'obj', v: null }, { t: 'obj', v: null }, ctx), bool(true))
  assert.equal(errNo(() => binary('is', int(1), o, ctx)), 424)
})
