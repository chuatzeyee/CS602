// Builds the offline exam kit next to the course folder: ~/SMU/CS602/CS602-exam-kit/ and CS602-exam-kit.zip.
// The kit holds the offline HTML, the course files listed in src/data/kit.ts, and solved mock workbooks generated
// from the mocks' reference solutions (scripts/mock-xlsx.py writes the .xlsx). Run after `npm run offline`.
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { kitGroups } from '../src/data/kit'
import { mocks } from '../src/data/lab'
import { referenceState } from '../src/lab/checker'
import { createLabSheet } from '../src/lab/sheet'
import { colLetter } from '../src/lab/refs'
import { answerLines, cleanPrompt } from '../src/data/worked'
import type { Exercise } from '../src/lab/types'

const COURSE = resolve('..')
const KIT = join(COURSE, 'CS602-exam-kit')
const HTML = resolve('offline/CS602-Guide.html')

if (!existsSync(HTML)) throw new Error('offline/CS602-Guide.html missing: run `npm run offline` first')
rmSync(KIT, { recursive: true, force: true })
mkdirSync(KIT, { recursive: true })
copyFileSync(HTML, join(KIT, 'CS602-Guide.html'))

const missing: string[] = []
for (const g of kitGroups) for (const f of g.files) {
  if (!f.src) continue
  const from = join(COURSE, f.src)
  if (!existsSync(from)) { missing.push(f.src); continue }
  mkdirSync(dirname(join(KIT, f.file)), { recursive: true })
  copyFileSync(from, join(KIT, f.file))
}
if (missing.length) throw new Error(`course files not found:\n  ${missing.join('\n  ')}`)

interface OutCell { f?: string; v?: string | number | boolean; fmt?: string; bold?: boolean }

// the reference-solved sheet: formulas where there are formulas, values elsewhere (data-table bodies included)
function solvedSheet(ex: Exercise) {
  const state = referenceState(ex)
  const sheet = createLabSheet(ex.sheet, { state })
  const cells: Record<string, OutCell> = {}
  for (let r = 0; r < sheet.rows; r++) for (let c = 0; c < sheet.cols; c++) {
    const ref = `${colLetter(c)}${r + 1}`
    const raw = sheet.raw(ref)
    const read = sheet.read(ref)
    const fmt = state.fmts?.[ref] ?? ex.sheet.cells[ref]?.fmt
    const bold = ex.sheet.cells[ref]?.bold || ['header'].includes(ex.sheet.cells[ref]?.role ?? '')
    if (raw.startsWith('=')) cells[ref] = { f: raw, fmt, bold }
    else if (read.kind !== 'empty' && read.kind !== 'error') cells[ref] = { v: read.value as string | number | boolean, fmt, bold }
  }
  const colWidths = Object.fromEntries(Object.entries(ex.sheet.colWidths ?? {}).map(([k, px]) => [k, Math.round(px / 7)]))
  return { cells, colWidths }
}

for (const m of mocks) {
  const letter = m.id.replace('mock-', '').toUpperCase()
  const spec = {
    title: m.title,
    sheets: m.questions.map(q => ({ name: q.id.toUpperCase(), ...solvedSheet(q.exercise) })),
    answers: m.questions.flatMap(q => q.exercise.tasks.map(t => ({
      question: q.id.toUpperCase(),
      marks: t.marks ?? '',
      task: cleanPrompt(t.prompt),
      answer: answerLines(t).join('\n'),
      steps: (t.hints ?? []).map(cleanPrompt).join('\n'),
      why: t.explain ? cleanPrompt(t.explain) : '',
    }))),
  }
  const json = join(tmpdir(), `cs602-mock-${letter}.json`)
  writeFileSync(json, JSON.stringify(spec))
  mkdirSync(join(KIT, 'mocks'), { recursive: true })
  execFileSync('python3', [resolve('scripts/mock-xlsx.py'), json, join(KIT, 'mocks', `Mock-${letter}-solved.xlsx`)], { stdio: 'inherit', cwd: tmpdir() })
}

rmSync(`${KIT}.zip`, { force: true })
execFileSync('python3', ['-c', `import shutil; shutil.make_archive(${JSON.stringify(KIT)}, 'zip', ${JSON.stringify(COURSE)}, 'CS602-exam-kit')`], { cwd: tmpdir() })
console.log(`kit: ${KIT}\nzip: ${KIT}.zip`)
