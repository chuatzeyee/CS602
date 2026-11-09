// Anticipated exam questions: original exam-style parts, one per likely question variant, with the answer formulas.
// Each file in this folder exports `questions: readonly AnticipatedQ[]`.

export interface AnticipatedFormula {
  cell: string        // answer cell, with the fill range if filled: 'F12' or 'F12 (fill to F12:F40)'
  formula: string     // starts with '=' (one cell's formula, exactly as typed in Excel)
  note?: string       // what it does, one short line
}

export interface AnticipatedQ {
  id: string                              // unique kebab-case, e.g. 'tax-progressive-bracket'
  topic: string                           // pattern id from src/data/patternsModel.ts / patternsSim.ts
  question: string                        // exam-style wording of the part, naming the answer cell(s)
  layout: string                          // where the given data sits, so the cell references make sense
  formulas: readonly AnticipatedFormula[] // may be empty for pure tool parts
  tool?: readonly string[]                // dialog settings in order (Solver, Goal Seek, Data Table, Advanced Filter, PivotTable)
  steps: readonly string[]                // 2-5 short steps
  pitfalls?: readonly string[]
  answer?: string                         // how to report it, or the value for the given numbers
}
