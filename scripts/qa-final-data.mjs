// browser QA for the final data/UX pass (mock sheet layout, mock review UX). Start a dev server first, then run this:
//   npx vite --port 4651 --strictPort   (stop it afterwards)
//   node scripts/qa-final-data.mjs      PORT=<port> for another server, ONLY=<regex> for a subset, SHOTS=<dir>
// checks: every mock question, opened in review mode on a submitted reference attempt (every answer filled), shows each
// grid text in full (no text wider than the room it has, no #### numbers), scanned over every row; screenshots of each
// sheet, of the areas reported as cut off (AREAS, read by eye) and of each clipped cell found; review mode at 1280px and 390px scrolls the player and the last task card clear
// of the fixed nav pill; a task fixed in review shows its submitted mark apart from the latest check.
// Screenshots: /tmp/cs602_final
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = process.env.PORT ?? '4651'
const ORIGIN = `http://localhost:${PORT}`
const APP = `${ORIGIN}/CS602/#`
const SHOTS = process.env.SHOTS ?? '/tmp/cs602_final'
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null
mkdirSync(SHOTS, { recursive: true })

try {
  if (!(await fetch(`${ORIGIN}/CS602/`)).ok) throw new Error('not ok')
} catch {
  console.error(`no dev server on ${ORIGIN}/CS602/: start one with npx vite --port ${PORT} --strictPort`)
  process.exit(2)
}

// ---------- runner ----------
const results = []
const notes = []
const note = s => notes.push(s)
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg)
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
let context = null
let page = null
const errors = []
async function openContext(viewport) {
  await context?.close()
  context = await browser.newContext({ viewport })
  page = await context.newPage()
  page.setDefaultTimeout(30000)
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`${page.url().replace(ORIGIN, '')} :: ${m.text()}`)
  })
  page.on('pageerror', e => errors.push(`${page.url().replace(ORIGIN, '')} :: ${e}`))
}
const width = () => page.viewportSize()?.width ?? 0
const shot = async (name, opts = {}) => page.screenshot({ path: `${SHOTS}/${name}-${width()}.png`, ...opts })

async function check(name, fn) {
  if (ONLY && !ONLY.test(name)) return
  const t0 = Date.now()
  const before = errors.length
  try {
    await fn()
    expect(errors.length === before, `console errors: ${errors.slice(before).join(' || ')}`)
    results.push({ ok: true, name, ms: Date.now() - t0 })
  } catch (e) {
    results.push({ ok: false, name, ms: Date.now() - t0, error: String(e.message ?? e).split('\n')[0] })
    await shot(`FAIL-${slug(name)}`).catch(() => undefined)
  }
}

// ---------- page helpers ----------
async function app(path, waitFor) {
  await page.goto(`${APP}${path}`)
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 60000 })
  await page.waitForTimeout(200)
}
const cards = () => page.locator('aside[aria-label="Tasks"] article')
const tab = i => page.getByRole('tab', { name: new RegExp(`^Q${i + 1}\\b`) })
const nameBox = () => page.getByLabel('Name box', { exact: true })
async function select(ref) {
  await nameBox().click()
  await nameBox().fill(ref)
  await nameBox().press('Enter')
  await page.waitForTimeout(80)
}
async function openQuestion(i) {
  await tab(i).click()
  await page.waitForSelector('[role="grid"]')
  await page.waitForTimeout(400)
}
async function confirmDialog(button) {
  const dlg = page.getByRole('alertdialog')
  await dlg.waitFor()
  await dlg.getByRole('button', { name: button, exact: true }).click()
  await dlg.waitFor({ state: 'detached', timeout: 60000 })
}

// mock, question and task ids with their marks, as the page sees them (vite serves the source modules)
async function loadMocks() {
  return page.evaluate(async () => {
    const m = await import('/CS602/src/data/lab/index.ts')
    return m.mocks.map(x => ({ id: x.id, questions: x.questions.map(q => ({ id: q.id, marks: q.marks, tasks: q.exercise.tasks.map(t => ({ id: t.id, kind: t.kind, marks: t.marks ?? 0 })) })) }))
  })
}

// a submitted attempt in the progress store: the reference answers (every cell filled) or a blank attempt
async function seedSubmitted(mockId, kind) {
  await page.evaluate(async ({ id, kind }) => {
    const data = await import('/CS602/src/data/lab/index.ts')
    const { referenceState } = await import('/CS602/src/lab/checker.ts')
    const mock = data.mocks.find(x => x.id === id)
    const states = kind === 'reference' ? Object.fromEntries(mock.questions.map(q => [q.id, referenceState(q.exercise)])) : {}
    const now = Date.now()
    localStorage.setItem(`cs602-mock:${id}`, JSON.stringify({ states, startedAt: now - 60_000, submittedAt: now }))
  }, { id: mockId, kind })
}
async function openReview(mockId, kind) {
  await app('/exam', 'h1')
  await seedSubmitted(mockId, kind)
  await app(`/exam/mock/${mockId}`)
  await page.getByText(/^Submitted$/).waitFor({ timeout: 120000 })
  await page.waitForSelector('[role="grid"]')
  await page.waitForTimeout(300)
}

// every grid cell whose text does not fit the room it has (its own width, plus the empty cells it spills into), and
// every number shown as ####. Rows are virtualised, so the grid is scrolled through from top to bottom.
async function clippedCells() {
  return page.evaluate(async () => {
    const grid = document.querySelector('[role="grid"]')
    const letter = c => {
      let s = ''
      for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
      return s
    }
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const found = new Map()
    const step = Math.max(48, grid.clientHeight - 72)
    for (let top = 0; ; top += step) {
      grid.scrollTop = top
      await frame()
      for (const cell of grid.querySelectorAll('[role="gridcell"]')) {
        const span = cell.querySelector('span')
        const text = span?.textContent ?? ''
        if (!text.trim()) continue
        const m = /-r(\d+)c(\d+)$/.exec(cell.id)
        const ref = m ? `${letter(Number(m[2]))}${Number(m[1]) + 1}` : cell.id
        const range = document.createRange()
        range.selectNodeContents(span)
        const need = range.getBoundingClientRect().width
        const room = span.getBoundingClientRect().width
        const hashes = /^#+$/.test(text.trim())
        if (need > room + 0.5 || hashes) {
          found.set(ref, { ref, text, need: Math.round(need * 10) / 10, room: Math.round(room * 10) / 10, hashes, title: cell.title })
        }
      }
      if (top + grid.clientHeight >= grid.scrollHeight) break
    }
    grid.scrollTop = 0
    await frame()
    return [...found.values()]
  })
}

// the cells reported as cut off, shown with their neighbours (the area screenshots are read by eye)
const AREAS = {
  'mock-a-q1': ['E1', 'L1', 'H12', 'L16', 'G39'],
  'mock-a-q2': ['A1', 'G4', 'L4', 'P4', 'L13', 'F28'],
  'mock-b-q1': ['A1', 'G1', 'G11', 'M11', 'T11'],
  'mock-b-q2': ['A1', 'G1', 'E8', 'A13', 'H13', 'Q14', 'H40', 'A42'],
  'mock-c-q1': ['A1', 'E1', 'S1', 'A16', 'J16', 'P16', 'W16', 'D9'],
  'mock-c-q2': ['A1', 'D9', 'P11', 'I18'],
}
const cellOf = ref => {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)
  return { r: Number(m[2]) - 1, c: [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 }
}
// scroll the grid so `ref` sits at the top-left of the visible cells
async function showArea(ref) {
  await select(ref)
  await page.evaluate(({ r, c }) => {
    const grid = document.querySelector('[role="grid"]')
    const cell = grid.querySelector(`[id$="-r${r}c${c}"]`)
    if (!cell) return
    const g = grid.getBoundingClientRect()
    const b = cell.getBoundingClientRect()
    // frozen rows stay on top: put the row just under them
    const frozen = grid.querySelector('[role="rowgroup"].sticky')?.getBoundingClientRect().height ?? 0
    grid.scrollLeft += b.left - g.left - 44
    grid.scrollTop += b.top - g.top - 24 - frozen
  }, cellOf(ref))
  await page.waitForTimeout(200)
}

// ---------- 1. mock sheets: nothing cut off in review mode (every answer filled) ----------
await openContext({ width: 1280, height: 900 })
await app('/exam', 'h1')
const mocks = await loadMocks()
const font = await page.evaluate(async () => {
  await document.fonts.ready
  return document.fonts.check('12px "JetBrains Mono"') ? 'JetBrains Mono' : 'fallback monospace'
})
note(`grid font: ${font}`)

for (const m of mocks) {
  await check(`${m.id}: every grid text fits its cell in review mode (reference attempt)`, async () => {
    await openReview(m.id, 'reference')
    const bad = []
    for (const [i, q] of m.questions.entries()) {
      await openQuestion(i)
      const grid = page.locator('section[aria-label="Spreadsheet"]')
      await grid.scrollIntoViewIfNeeded()
      await grid.screenshot({ path: `${SHOTS}/${m.id}-${q.id}-sheet-${width()}.png` })
      const clipped = await clippedCells()
      for (const c of clipped) {
        bad.push(`${q.id} ${c.ref} "${c.text}" (${c.hashes ? '####' : `${c.need}px text in ${c.room}px`})`)
        await select(c.ref)
        await grid.screenshot({ path: `${SHOTS}/clip-${m.id}-${q.id}-${c.ref}-${width()}.png` })
      }
      for (const ref of AREAS[`${m.id}-${q.id}`] ?? []) {
        await showArea(ref)
        await grid.screenshot({ path: `${SHOTS}/area-${m.id}-${q.id}-${ref}-${width()}.png` })
      }
      note(`${m.id} ${q.id}: ${clipped.length} clipped cell(s)`)
    }
    expect(!bad.length, `clipped: ${bad.join('; ')}`)
  })
}

// ---------- 2. review UX: submitted marks apart from the latest check; room under the nav pill ----------
const rectOf = sel => page.evaluate(s => {
  const el = s === 'last-card' ? [...document.querySelectorAll('aside[aria-label="Tasks"] article')].pop() : document.querySelector(s)
  const b = el?.getBoundingClientRect()
  return b ? { top: Math.round(b.top), bottom: Math.round(b.bottom) } : null
}, sel)

await check('review 1280: a task fixed in review shows ✓ on its card and keeps its submitted 0 mark in the Submitted marks list', async () => {
  const m = mocks[0]
  const q = m.questions[0]
  await openReview(m.id, 'blank')
  await openQuestion(0)
  const strip = page.locator('section[aria-label="Submitted marks"]')
  await strip.waitFor()
  const chips = (await strip.locator('li').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim())
  expect(chips.length === q.tasks.length, `${chips.length} chips for ${q.tasks.length} tasks`)
  const first = `Task 1 0/${q.tasks[0].marks}`
  expect(chips[0] === first, `first chip reads "${chips[0]}", expected "${first}"`)
  expect((await strip.innerText()).includes('marks submitted'), 'no "marks submitted" line')
  // the cards show each task's worth (as in the exam), never a got/max that a later ✓ would contradict
  for (const [j, t] of q.tasks.entries()) {
    const head = (await cards().nth(j).locator('button').first().innerText()).replace(/\s+/g, ' ')
    expect(!/\/\d+(\.\d+)? marks?\b/.test(head), `card ${j + 1} header shows got/max marks: "${head}"`)
    expect(head.includes(`${t.marks} mark`), `card ${j + 1} header "${head}" lacks its ${t.marks} mark(s)`)
  }
  const card = cards().first()
  expect((await card.locator('[aria-label="Not yet correct"]').count()) === 1, 'task 1 is not marked wrong after a blank submit')
  await card.locator('button').first().click()
  await card.getByRole('button', { name: /^Reveal/ }).click()
  await confirmDialog('Reveal')
  await card.locator('[aria-label="Correct"]').waitFor({ timeout: 30000 })
  const after = (await strip.locator('li').first().innerText()).replace(/\s+/g, ' ').trim()
  expect(after === first, `after the reveal the chip reads "${after}"`)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.locator('aside[aria-label="Tasks"]').evaluate(el => { el.scrollTop = 0 })
  await shot('review-fixed-task')
  await strip.screenshot({ path: `${SHOTS}/review-submitted-marks-${width()}.png` })
  note(`review: chips ${chips.slice(0, 4).join(' | ')} ...; task 1 ✓ after Reveal, chip still "${after}"`)
})

await check('review 1280: scrolled to the end, the player and the last task card sit above the nav pill', async () => {
  const m = mocks[2]
  await openReview(m.id, 'blank')
  await openQuestion(1)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.locator('aside[aria-label="Tasks"]').evaluate(el => { el.scrollTop = el.scrollHeight })
  await page.waitForTimeout(300)
  const pill = await rectOf('nav.fixed > div')
  const sheet = await rectOf('section[aria-label="Spreadsheet"]')
  const last = await rectOf('last-card')
  expect(sheet.bottom <= pill.top - 16, `sheet bottom ${sheet.bottom}, pill top ${pill.top}`)
  expect(last.bottom <= pill.top - 16, `last task card bottom ${last.bottom}, pill top ${pill.top}`)
  await shot('review-bottom')
  note(`1280 review at the end: sheet bottom ${sheet.bottom}, last card bottom ${last.bottom}, pill top ${pill.top}`)
})

await openContext({ width: 390, height: 844 })
await check('review 390: the last task cards and the sheet scroll clear of the nav pill; the marks list fits', async () => {
  const m = mocks[2]
  await openReview(m.id, 'blank')
  await openQuestion(1)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow <= 1, `the review page scrolls sideways by ${overflow}px`)
  await page.locator('section[aria-label="Submitted marks"]').screenshot({ path: `${SHOTS}/review-submitted-marks-${width()}.png` })
  // the last task card at the bottom of the screen (where the pill covers it), then scrolled on to the page end
  await page.evaluate(() => [...document.querySelectorAll('aside[aria-label="Tasks"] article')].pop().scrollIntoView({ block: 'end' }))
  await page.waitForTimeout(300)
  await shot('review-last-card')
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(300)
  const pill = await rectOf('nav.fixed > div')
  const sheet = await rectOf('section[aria-label="Spreadsheet"]')
  const last = await rectOf('last-card')
  expect(sheet.bottom <= pill.top - 16, `sheet bottom ${sheet.bottom}, pill top ${pill.top}`)
  expect(last.bottom <= pill.top - 16, `last task card bottom ${last.bottom}, pill top ${pill.top}`)
  await shot('review-bottom')
  note(`390 review at the end: sheet bottom ${sheet.bottom}, last card bottom ${last.bottom}, pill top ${pill.top}`)
})

// ---------- report ----------
await context?.close()
await browser.close()
const failed = results.filter(r => !r.ok)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name} (${(r.ms / 1000).toFixed(1)} s)${r.ok ? '' : `\n      ${r.error}`}`)
for (const n of notes) console.log(`  note: ${n}`)
if (errors.length) console.log(`console errors:\n  ${errors.join('\n  ')}`)
console.log(`${results.length - failed.length}/${results.length} checks passed; screenshots in ${SHOTS}`)
writeFileSync(`${SHOTS}/results.json`, JSON.stringify({ results, notes, errors }, null, 1))
process.exit(failed.length ? 1 : 0)
