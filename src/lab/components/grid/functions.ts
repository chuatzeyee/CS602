// function-name autocomplete and one-line syntax hints for the formula editor
import { HyperFormula } from 'hyperformula'
import { formulas } from '../../../data/formulas'

// standard Excel argument lists (fallback when the course function bank has no signature)
const SIGNATURES: Record<string, string> = {
  SUM: 'number1, [number2], ...', AVERAGE: 'number1, [number2], ...', MIN: 'number1, [number2], ...',
  MAX: 'number1, [number2], ...', COUNT: 'value1, [value2], ...', COUNTA: 'value1, [value2], ...',
  COUNTBLANK: 'range', COUNTIF: 'range, criteria',
  COUNTIFS: 'criteria_range1, criteria1, [criteria_range2, criteria2], ...',
  SUMIF: 'range, criteria, [sum_range]',
  SUMIFS: 'sum_range, criteria_range1, criteria1, [criteria_range2, criteria2], ...',
  AVERAGEIF: 'range, criteria, [average_range]',
  AVERAGEIFS: 'average_range, criteria_range1, criteria1, [criteria_range2, criteria2], ...',
  MAXIFS: 'max_range, criteria_range1, criteria1, ...', MINIFS: 'min_range, criteria_range1, criteria1, ...',
  SUMPRODUCT: 'array1, [array2], [array3], ...', SUMSQ: 'number1, [number2], ...',
  ROUND: 'number, num_digits', ROUNDUP: 'number, num_digits', ROUNDDOWN: 'number, num_digits',
  INT: 'number', MOD: 'number, divisor', ABS: 'number', SQRT: 'number', POWER: 'number, power', EXP: 'number',
  LN: 'number', LOG: 'number, [base]', LOG10: 'number', PI: '', SIN: 'number', COS: 'number', SIGN: 'number',
  CEILING: 'number, significance', FLOOR: 'number, significance', FACT: 'number', COMBIN: 'number, number_chosen',
  IF: 'logical_test, [value_if_true], [value_if_false]', IFS: 'logical_test1, value_if_true1, ...',
  AND: 'logical1, [logical2], ...', OR: 'logical1, [logical2], ...', NOT: 'logical',
  IFERROR: 'value, value_if_error', IFNA: 'value, value_if_na',
  VLOOKUP: 'lookup_value, table_array, col_index_num, [range_lookup]',
  HLOOKUP: 'lookup_value, table_array, row_index_num, [range_lookup]',
  LOOKUP: 'lookup_value, lookup_vector, [result_vector]',
  INDEX: 'array, row_num, [column_num]', MATCH: 'lookup_value, lookup_array, [match_type]',
  XLOOKUP: 'lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode]',
  CHOOSE: 'index_num, value1, [value2], ...', OFFSET: 'reference, rows, cols, [height], [width]',
  ROW: '[reference]', COLUMN: '[reference]', ROWS: 'array', COLUMNS: 'array', TRANSPOSE: 'array',
  PMT: 'rate, nper, pv, [fv], [type]', PV: 'rate, nper, pmt, [fv], [type]', FV: 'rate, nper, pmt, [pv], [type]',
  NPV: 'rate, value1, [value2], ...', IRR: 'values, [guess]', RATE: 'nper, pmt, pv, [fv], [type], [guess]',
  NPER: 'rate, pmt, pv, [fv], [type]', IPMT: 'rate, per, nper, pv, [fv], [type]',
  PPMT: 'rate, per, nper, pv, [fv], [type]',
  RAND: '', RANDBETWEEN: 'bottom, top',
  NORMINV: 'probability, mean, standard_dev', 'NORM.INV': 'probability, mean, standard_dev',
  NORMSINV: 'probability', 'NORM.S.INV': 'probability',
  NORMDIST: 'x, mean, standard_dev, cumulative', 'NORM.DIST': 'x, mean, standard_dev, cumulative',
  NORMSDIST: 'z', 'NORM.S.DIST': 'z, cumulative',
  CRITBINOM: 'trials, probability_s, alpha', 'BINOM.INV': 'trials, probability_s, alpha',
  BINOMDIST: 'number_s, trials, probability_s, cumulative', 'BINOM.DIST': 'number_s, trials, probability_s, cumulative',
  POISSON: 'x, mean, cumulative', 'POISSON.DIST': 'x, mean, cumulative', 'EXPON.DIST': 'x, lambda, cumulative',
  PERCENTILE: 'array, k', 'PERCENTILE.INC': 'array, k', PERCENTRANK: 'array, x, [significance]',
  'PERCENTRANK.INC': 'array, x, [significance]', QUARTILE: 'array, quart',
  MEDIAN: 'number1, [number2], ...', MODE: 'number1, [number2], ...', 'MODE.SNGL': 'number1, [number2], ...',
  STDEV: 'number1, [number2], ...', 'STDEV.S': 'number1, [number2], ...', 'STDEV.P': 'number1, [number2], ...',
  VAR: 'number1, [number2], ...', 'VAR.S': 'number1, [number2], ...', 'VAR.P': 'number1, [number2], ...',
  LARGE: 'array, k', SMALL: 'array, k', RANK: 'number, ref, [order]', 'RANK.EQ': 'number, ref, [order]',
  TODAY: '', NOW: '', DATE: 'year, month, day', TIME: 'hour, minute, second',
  YEAR: 'serial_number', MONTH: 'serial_number', DAY: 'serial_number', WEEKDAY: 'serial_number, [return_type]',
  HOUR: 'serial_number', MINUTE: 'serial_number', SECOND: 'serial_number',
  DATEDIF: 'start_date, end_date, unit', EDATE: 'start_date, months', EOMONTH: 'start_date, months',
  NETWORKDAYS: 'start_date, end_date, [holidays]', WORKDAY: 'start_date, days, [holidays]',
  TEXT: 'value, format_text', VALUE: 'text', LEFT: 'text, [num_chars]', RIGHT: 'text, [num_chars]',
  MID: 'text, start_num, num_chars', LEN: 'text', TRIM: 'text', UPPER: 'text', LOWER: 'text', PROPER: 'text',
  CONCATENATE: 'text1, [text2], ...', CONCAT: 'text1, [text2], ...',
  FIND: 'find_text, within_text, [start_num]', SEARCH: 'find_text, within_text, [start_num]',
  SUBSTITUTE: 'text, old_text, new_text, [instance_num]',
  TREND: "known_y's, [known_x's], [new_x's], [const]", FORECAST: "x, known_y's, known_x's",
  'FORECAST.LINEAR': "x, known_y's, known_x's", SLOPE: "known_y's, known_x's", INTERCEPT: "known_y's, known_x's",
  CORREL: 'array1, array2', FREQUENCY: 'data_array, bins_array', MMULT: 'array1, array2',
  ISNUMBER: 'value', ISBLANK: 'value', ISERROR: 'value', ISTEXT: 'value',
}

// Google-Sheets-only names HyperFormula also registers
const NOT_EXCEL = new Set(['ARRAYFORMULA', 'ARRAY_CONSTRAIN', 'SPLIT', 'COUNTUNIQUE', 'HF.ADD', 'HF.CONCAT', 'HF.DIVIDE',
  'HF.EQ', 'HF.GT', 'HF.GTE', 'HF.LT', 'HF.LTE', 'HF.MINUS', 'HF.MULTIPLY', 'HF.NE', 'HF.POW', 'HF.UMINUS',
  'HF.UNARY_PERCENT', 'HF.UPLUS', 'VERSION'])

interface Catalog { names: string[]; course: Set<string>; examples: Map<string, string>; signatures: Map<string, string> }
let catalog: Catalog | null = null

function build(): Catalog {
  let registered: string[] = []
  try {
    registered = HyperFormula.getRegisteredFunctionNames('enGB')
  } catch {
    registered = Object.keys(SIGNATURES)
  }
  const known = new Set(registered.map(n => n.toUpperCase()).filter(n => !NOT_EXCEL.has(n)))
  const course = new Set<string>()
  const examples = new Map<string, string>()
  const signatures = new Map<string, string>()
  for (const f of formulas) {
    for (const m of `${f.formula} ${f.note}`.matchAll(/\b([A-Z][A-Z0-9]*(?:\.[A-Z0-9]+)*)\b/g)) {
      if (m[1].length > 1 && known.has(m[1])) course.add(m[1])
    }
    for (const m of f.formula.matchAll(/([A-Z][A-Z0-9.]*)\(/g)) {
      const name = m[1]
      if (!known.has(name)) continue
      const sig = new RegExp(String.raw`^=${name.replace(/\./g, '\\.')}\(([a-z_\[\], .']+)\)$`).exec(f.formula.trim())
      if (sig && !signatures.has(name)) signatures.set(name, sig[1])
      if (!examples.has(name) && !sig) examples.set(name, f.formula.split(/\s{2,}|\s+→/)[0].trim())
    }
  }
  return { names: [...known].sort(), course, examples, signatures }
}

function cat(): Catalog {
  if (!catalog) catalog = build()
  return catalog
}

/** function names starting with prefix; course functions (from the function bank) first */
export function matchFunctions(prefix: string, limit = 8): string[] {
  const p = prefix.toUpperCase()
  if (!p) return []
  const { names, course } = cat()
  const hits = names.filter(n => n.startsWith(p))
  const ranked = [...hits.filter(n => course.has(n)), ...hits.filter(n => !course.has(n))]
  return ranked.slice(0, limit)
}

export function isCourseFunction(name: string): boolean {
  return cat().course.has(name.toUpperCase())
}

export interface SyntaxHint { name: string; args: string[]; example?: string }

/** the argument list for FUNC (course function bank first, then standard Excel syntax) plus a bank example */
export function syntaxHint(name: string): SyntaxHint | null {
  const n = name.toUpperCase()
  const { signatures, examples, names } = cat()
  const sig = signatures.get(n) ?? SIGNATURES[n]
  const example = examples.get(n)
  if (sig === undefined && !example) return names.includes(n) ? { name: n, args: [] } : null
  return { name: n, args: sig ? splitArgs(sig) : [], example }
}

function splitArgs(sig: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of sig) {
    if (ch === '[') depth++
    if (ch === ']') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
