// Checks the anticipated-question files: formula syntax (HyperFormula), unique ids, known pattern ids, banned
// characters, and that every cell a formula reads is mentioned in the layout or question.
// Usage: npx tsx scripts/check-anticipated.ts [file ...]   (default: every file in src/data/anticipated)
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { HyperFormula } from 'hyperformula'
import { patterns } from '../src/data/patterns'
import type { AnticipatedQ } from '../src/data/anticipated/types'

const dir = resolve('src/data/anticipated')
const files = process.argv.slice(2).length ? process.argv.slice(2).map(f => resolve(f)) : readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'types.ts' && f !== 'index.ts').map(f => resolve(dir, f))
const hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })
const topics = new Set(patterns.map(p => p.id))
const BANNED = /[—–·…−‘’“”≈×→›]/
const errors: string[] = []
const ids = new Set<string>()
let count = 0

// cell refs a formula reads, without $ and sheet names, ranges split into their corner cells
const refsOf = (f: string) => [...f.replace(/"[^"]*"/g, '').matchAll(/\$?([A-Z]{1,2})\$?(\d+)(?::\$?([A-Z]{1,2})\$?(\d+))?/g)]
  .map(m => (m[3] ? [`${m[1]}${m[2]}`, `${m[3]}${m[4]}`] : [`${m[1]}${m[2]}`])).flat()

for (const file of files) {
  const mod = (await import(pathToFileURL(file).href)) as { questions?: readonly AnticipatedQ[] }
  if (!Array.isArray(mod.questions)) { errors.push(`${file}: no exported questions array`); continue }
  for (const q of mod.questions) {
    count++
    const where = `${file.split('/').pop()}:${q.id}`
    if (ids.has(q.id)) errors.push(`${where}: duplicate id`)
    ids.add(q.id)
    if (!topics.has(q.topic)) errors.push(`${where}: unknown topic "${q.topic}"`)
    if (!q.question || !q.layout || !q.steps?.length) errors.push(`${where}: question, layout and steps are required`)
    if (q.formulas.length === 0 && !q.tool?.length) errors.push(`${where}: needs formulas or tool settings`)
    if (BANNED.test(JSON.stringify(q))) errors.push(`${where}: banned character (em/en dash, middle dot, ellipsis, minus sign, curly quote, x sign, arrow)`)
    const text = `${q.question} ${q.layout} ${(q.tool ?? []).join(' ')}`.replace(/\$/g, '')
    for (const f of q.formulas) {
      if (!f.formula.startsWith('=')) { errors.push(`${where}: formula for ${f.cell} must start with =`); continue }
      if (!hf.validateFormula(f.formula)) errors.push(`${where}: syntax error in ${f.cell}: ${f.formula}`)
      const answerCells = refsOf(f.cell)
      for (const r of refsOf(f.formula)) {
        if (answerCells.includes(r)) continue
        // a ref is explained if its own address, or a range containing it, appears in the layout or question text
        if (!new RegExp(`\\b${r}\\b`).test(text) && !mentionedInRange(r, text)) errors.push(`${where}: ${f.cell} reads ${r}, which the layout never mentions`)
      }
    }
  }
}

function mentionedInRange(ref: string, text: string): boolean {
  const [, c, r] = /([A-Z]+)(\d+)/.exec(ref)!
  const col = (s: string) => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
  for (const m of text.matchAll(/\b([A-Z]{1,2})(\d+):([A-Z]{1,2})(\d+)\b/g)) {
    const [c1, r1, c2, r2] = [col(m[1]), +m[2], col(m[3]), +m[4]]
    if (col(c) >= Math.min(c1, c2) && col(c) <= Math.max(c1, c2) && +r >= Math.min(r1, r2) && +r <= Math.max(r1, r2)) return true
  }
  return false
}

// earlier rows of an expanding or filled range (G14 in $G$14:G14, or E15 when E16 fills) count as mentioned only via the layout
console.log(`${count} questions in ${files.length} file(s), ${errors.length} problem(s)`)
for (const e of errors) console.log('  ' + e)
process.exit(errors.length ? 1 : 0)
