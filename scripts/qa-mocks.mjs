// browser QA for the three mock exams (src/data/lab/mocks.ts). Start a dev server first, then run this:
//   npx vite --port 4631 --strictPort   (stop it afterwards)
//   node scripts/qa-mocks.mjs           PORT=<port> to test another server, ONLY=<regex> for a subset of checks
// checks: /#/exam lists every mock with minutes and marks; each mock's intro; Start; both question tabs render the
// sheet and their task cards with marks; Submit of a blank attempt scores 0; review mode reveals every task (self-marks
// the written ones) and a re-check ticks every task (= full marks); a reference attempt submitted through the page scores
// full marks; the 390px layout. Screenshots: /tmp/cs602_mocks
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = process.env.PORT ?? '4631'
const ORIGIN = `http://localhost:${PORT}`
const APP = `${ORIGIN}/CS602/#`
const SHOTS = process.env.SHOTS ?? '/tmp/cs602_mocks'
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
const fmtMarks = n => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))))
const sum = xs => xs.reduce((n, x) => n + x, 0)

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
let context = null
let page = null
const errors = []
const navigations = []
async function openContext(viewport) {
  await context?.close()
  context = await browser.newContext({ viewport })
  page = await context.newPage()
  page.setDefaultTimeout(30000)
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`${page.url().replace(ORIGIN, '')} :: ${m.text()}`)
  })
  page.on('pageerror', e => errors.push(`${page.url().replace(ORIGIN, '')} :: ${e}`))
  // a reload nobody asked for (HMR after another agent's edit, a re-optimised dependency) would void a check
  page.on('framenavigated', f => {
    if (f === page.mainFrame()) navigations.push(f.url())
  })
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
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 30000 })
  await page.waitForTimeout(200)
}
const toolbar = () => page.getByRole('toolbar', { name: 'Spreadsheet tools' })
const tool = label => toolbar().getByRole('button', { name: label, exact: true })
const cards = () => page.locator('aside[aria-label="Tasks"] article')
const nameBox = () => page.getByLabel('Name box', { exact: true })
const tab = i => page.getByRole('tab', { name: new RegExp(`^Q${i + 1}\\b`) })
const resultTotal = async () => {
  const m = /(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/.exec(await page.locator('section[aria-label="Result"] p.text-3xl').innerText())
  expect(m, 'no total score in the Result panel')
  return [Number(m[1]), Number(m[2])]
}
const questionChips = async () => (await page.locator('section[aria-label="Result"] ul li').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim())

const colNum = s => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
const cellOf = ref => {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref.trim().toUpperCase())
  return m ? { r: Number(m[2]) - 1, c: colNum(m[1]) } : null
}
async function select(ref) {
  await nameBox().click()
  await nameBox().fill(ref)
  await nameBox().press('Enter')
  await page.waitForTimeout(60)
}
async function cellText(ref) {
  const p = cellOf(ref)
  await select(ref)
  return (await page.locator(`[role="grid"] [id$="-r${p.r}c${p.c}"]`).first().innerText()).trim()
}
async function confirmDialog(button) {
  const dlg = page.getByRole('alertdialog')
  await dlg.waitFor()
  await dlg.getByRole('button', { name: button, exact: true }).click()
  await dlg.waitFor({ state: 'detached', timeout: 60000 })
}
async function runCheck() {
  await tool('Check').click()
  await page.waitForFunction(
    () => ![...document.querySelectorAll('[role="toolbar"] button')].some(b => (b.textContent ?? '').includes('Checking')),
    null, { timeout: 120000 },
  )
  await page.waitForTimeout(200)
}
const statusOf = async i => {
  const card = cards().nth(i)
  for (const label of ['Correct', 'Not yet correct', 'Waiting for your self-mark']) {
    if (await card.locator(`[aria-label="${label}"]`).count()) return label
  }
  return 'unchecked'
}
const messagesOf = async i => (await cards().nth(i).locator('ul li').allInnerTexts()).map(s => s.trim()).filter(Boolean)
async function openQuestion(i) {
  await tab(i).click()
  await page.waitForSelector('[role="grid"]')
  await page.waitForTimeout(300)
}
// no sideways scrolling of the page itself (the grid scrolls inside its own box)
const overflowX = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
async function inViewportX(locator, what) {
  const b = await locator.boundingBox()
  expect(b, `${what} not rendered`)
  expect(b.x >= -1 && b.x + b.width <= width() + 1, `${what} sticks out of the ${width()}px viewport (x ${Math.round(b.x)}, w ${Math.round(b.width)})`)
}

// mock data as the page sees it (vite serves the source modules)
async function loadMocks() {
  return page.evaluate(async () => {
    const m = await import('/CS602/src/data/lab/index.ts')
    const first = sheet => Object.entries(sheet.cells).find(([, c]) => typeof c.v === 'string' && c.v.trim().length > 2)
    return m.mocks.map(x => ({
      id: x.id, title: x.title, minutes: x.minutes, basedOn: x.basedOn, intro: x.intro,
      questions: x.questions.map(q => ({
        id: q.id, title: q.title, marks: q.marks,
        label: first(q.exercise.sheet),
        tasks: q.exercise.tasks.map(t => ({ id: t.id, kind: t.kind, tool: t.tool ?? null, marks: t.marks ?? 0, cells: t.cells })),
      })),
    }))
  })
}

// ---------- desktop: exam page and every mock ----------
await openContext({ width: 1280, height: 900 })
await app('/exam', 'h1')
const mocks = await loadMocks()
note(`mocks: ${mocks.map(m => `${m.id} [${m.questions.map(q => `${q.id} ${fmtMarks(q.marks)}m/${q.tasks.length} tasks`).join(', ')}]`).join('; ')}`)

await check('exam page lists every mock with minutes, marks and a Start link', async () => {
  expect(mocks.length === 3, `${mocks.length} mocks, expected 3`)
  await app('/exam', 'h1')
  const section = page.locator('section#mocks')
  await section.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  for (const m of mocks) {
    const marks = sum(m.questions.map(q => q.marks))
    const card = section.locator('div.bg-surface', { has: page.locator('h3', { hasText: m.title }) })
    expect((await card.count()) === 1, `${m.id}: no card titled "${m.title}"`)
    const text = (await card.innerText()).replace(/\s+/g, ' ').trim()
    expect(text.includes(m.basedOn), `${m.id}: basedOn missing`)
    expect(text.includes(`${m.minutes} min`), `${m.id}: no "${m.minutes} min"`)
    expect(text.includes(`${fmtMarks(marks)} marks`), `${m.id}: no "${fmtMarks(marks)} marks" in "${text}"`)
    expect((await card.locator(`a[href="#/exam/mock/${m.id}"]`).count()) === 1, `${m.id}: no Start link`)
    note(`exam list: ${text}`)
  }
  await section.screenshot({ path: `${SHOTS}/exam-mocks-${width()}.png` })
})

for (const m of mocks) {
  const total = sum(m.questions.map(q => q.marks))
  const written = sum(m.questions.flatMap(q => q.tasks.filter(t => t.kind === 'explain').map(t => t.marks)))
  const navBefore = () => navigations.length

  await check(`${m.id}: intro, Start, both question tabs render the sheet and the tasks with marks`, async () => {
    await app('/exam', 'h1')
    await page.evaluate(id => localStorage.removeItem(`cs602-mock:${id}`), m.id)
    await app(`/exam/mock/${m.id}`, 'h1')
    await page.getByRole('button', { name: /Start the exam/ }).waitFor()
    expect((await page.locator('h1').innerText()).trim() === m.title, 'intro heading is not the mock title')
    const main = (await page.locator('main').innerText()).replace(/[ \t]+/g, ' ')
    expect(main.includes(m.basedOn), 'basedOn missing on the intro')
    expect(main.includes(`${m.minutes} min`), `no "${m.minutes} min" on the intro`)
    for (const line of m.intro.split('\n')) expect(main.includes(line.trim()), `intro line missing: ${line.slice(0, 50)}`)
    const marksBox = page.locator('dl div', { hasText: 'Marks' }).locator('dd')
    expect((await marksBox.innerText()).trim() === fmtMarks(total), `intro shows ${await marksBox.innerText()} marks, expected ${total}`)
    for (const [i, q] of m.questions.entries()) {
      const li = page.locator('main ul li', { hasText: q.title })
      expect((await li.count()) === 1, `intro does not list ${q.id}`)
      const t = (await li.innerText()).replace(/\s+/g, ' ')
      expect(t.startsWith(`Q${i + 1}`) && t.endsWith(`${fmtMarks(q.marks)} marks`), `intro row for ${q.id}: "${t}"`)
    }
    await shot(`${m.id}-intro`, { fullPage: true })
    await page.getByRole('button', { name: /Start the exam/ }).click()
    await page.waitForSelector('[role="grid"]')
    expect((await page.getByRole('timer').count()) === 1, 'no timer')
    expect((await tool('Check').count()) === 0, 'Check visible during the exam')
    expect((await page.getByRole('button', { name: /^Reveal/ }).count()) === 0, 'Reveal visible during the exam')
    for (const [i, q] of m.questions.entries()) {
      await openQuestion(i)
      const tabText = (await tab(i).innerText()).replace(/\s+/g, ' ')
      expect(tabText.includes(`${fmtMarks(q.marks)} marks`), `tab Q${i + 1} reads "${tabText}"`)
      expect((await cards().count()) === q.tasks.length, `${q.id}: ${await cards().count()} task cards, expected ${q.tasks.length}`)
      for (const [j, t] of q.tasks.entries()) {
        const head = (await cards().nth(j).locator('button').first().innerText()).replace(/\s+/g, ' ')
        expect(head.includes(`Task ${j + 1}`) && head.includes(`${fmtMarks(t.marks)} mark`), `${q.id} card ${j + 1} header "${head}" lacks ${t.marks} marks`)
      }
      const [ref, spec] = q.label
      const shown = await cellText(ref)
      expect(shown.includes(spec.v.trim().slice(0, 20)), `${q.id}: ${ref} shows "${shown}", expected "${spec.v}"`)
      await page.locator('aside[aria-label="Tasks"]').evaluate(el => { el.scrollTop = 0 })
      await shot(`${m.id}-exam-q${i + 1}`)
    }
  })

  await check(`${m.id}: Submit of a blank attempt scores 0/${total}`, async () => {
    const nav = navBefore()
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await confirmDialog('Submit')
    await page.getByText(/^Submitted$/).waitFor({ timeout: 120000 })
    const [got, max] = await resultTotal()
    expect(max === total, `max ${max}, expected ${total}`)
    expect(got === 0, `blank attempt scored ${got}`)
    const chips = await questionChips()
    expect(m.questions.every((q, i) => chips[i] === `Q${i + 1} 0/${fmtMarks(q.marks)}`), `question chips: ${chips.join(', ')}`)
    expect(navigations.length === nav, `the page navigated during the check: ${navigations.slice(nav).join(', ')}`)
    note(`${m.id}: blank attempt ${got}/${max} (${chips.join(', ')})`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await shot(`${m.id}-submitted-blank`)
  })

  await check(`${m.id}: review reveals every task and a re-check ticks every task (full marks)`, async () => {
    const nav = navBefore()
    expect((await tool('Check').count()) === 1, 'review mode has no Check')
    let ticked = 0
    for (const [qi, q] of m.questions.entries()) {
      await openQuestion(qi)
      expect((await cards().count()) === q.tasks.length, `${q.id}: ${await cards().count()} cards in review`)
      const t0 = Date.now()
      for (const [ti, t] of q.tasks.entries()) {
        const card = cards().nth(ti)
        await card.locator('button').first().click()
        if (t.kind === 'explain') {
          await card.getByRole('button', { name: 'Show model answer' }).click()
          await card.getByRole('button', { name: 'Got it' }).click()
          continue
        }
        await card.getByRole('button', { name: /^Reveal/ }).click()
        await confirmDialog('Reveal')
        await page.waitForTimeout(150)
      }
      const t1 = Date.now()
      await runCheck()
      const t2 = Date.now()
      const bad = []
      let got = 0
      for (const [ti, t] of q.tasks.entries()) {
        const s = await statusOf(ti)
        if (s === 'Correct') got += t.marks
        else bad.push(`${t.id}: ${s} ${(await messagesOf(ti)).join(' / ')}`)
      }
      await page.locator('aside[aria-label="Tasks"]').evaluate(el => { el.scrollTop = 0 })
      await shot(`${m.id}-review-q${qi + 1}`)
      expect(!bad.length, `${q.id}: ${bad.join(' | ')}`)
      expect(Math.abs(got - q.marks) < 1e-9, `${q.id}: ticked tasks are worth ${got}, the question ${q.marks}`)
      ticked += got
      note(`${m.id} ${q.id}: ${q.tasks.length}/${q.tasks.length} tasks correct after Reveal + Check = ${fmtMarks(got)}/${fmtMarks(q.marks)} marks (reveals ${((t1 - t0) / 1000).toFixed(1)} s, Check ${((t2 - t1) / 1000).toFixed(1)} s)`)
    }
    expect(Math.abs(ticked - total) < 1e-9, `re-check worth ${ticked}/${total}`)
    const [got2] = await resultTotal()
    expect(Math.abs(got2 - written) < 1e-9, `self-marking the written answers gave ${got2}, expected ${written}`)
    expect(navigations.length === nav, `the page navigated during the check: ${navigations.slice(nav).join(', ')}`)
    note(`${m.id}: review re-check ${fmtMarks(ticked)}/${fmtMarks(total)}; submitted mark after self-marking the written answers ${fmtMarks(got2)}/${fmtMarks(total)}`)
  })

  await check(`${m.id}: a reference attempt submitted through the page scores ${total}/${total}`, async () => {
    await page.evaluate(async id => {
      const data = await import('/CS602/src/data/lab/index.ts')
      const { referenceState } = await import('/CS602/src/lab/checker.ts')
      const mock = data.mocks.find(x => x.id === id)
      const states = Object.fromEntries(mock.questions.map(q => [q.id, referenceState(q.exercise)]))
      localStorage.setItem(`cs602-mock:${id}`, JSON.stringify({ states, startedAt: Date.now() }))
    }, m.id)
    await page.reload()
    await page.waitForSelector('[role="timer"]', { timeout: 30000 })
    const nav = navBefore()
    // each sheet builds from the stored answers before marking
    for (const [qi] of m.questions.entries()) await openQuestion(qi)
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await confirmDialog('Submit')
    await page.getByText(/^Submitted$/).waitFor({ timeout: 120000 })
    const [got, max] = await resultTotal()
    const chips = await questionChips()
    expect(got === total && max === total, `reference attempt scored ${got}/${max} (${chips.join(', ')})`)
    expect(navigations.length === nav, `the page navigated during the check: ${navigations.slice(nav).join(', ')}`)
    note(`${m.id}: reference attempt ${got}/${max} (${chips.join(', ')})`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await shot(`${m.id}-submitted-reference`)
    await page.evaluate(id => localStorage.removeItem(`cs602-mock:${id}`), m.id)
  })
}

// ---------- phone ----------
await check('phone 390px: exam list, intro, running exam and review are usable', async () => {
  await openContext({ width: 390, height: 844 })
  await app('/exam', 'h1')
  const section = page.locator('section#mocks')
  await section.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  expect((await overflowX()) <= 1, `/exam scrolls sideways by ${await overflowX()}px`)
  for (const m of mocks) await inViewportX(section.locator(`a[href="#/exam/mock/${m.id}"]`), `${m.id} Start link`)
  await section.screenshot({ path: `${SHOTS}/exam-mocks-${width()}.png` })
  for (const m of mocks) {
    await page.evaluate(id => localStorage.removeItem(`cs602-mock:${id}`), m.id)
    await app(`/exam/mock/${m.id}`, 'h1')
    await page.getByRole('button', { name: /Start the exam/ }).waitFor()
    expect((await overflowX()) <= 1, `${m.id} intro scrolls sideways by ${await overflowX()}px`)
    await inViewportX(page.getByRole('button', { name: /Start the exam/ }), `${m.id} Start button`)
    await shot(`${m.id}-intro`, { fullPage: true })
  }
  const m = mocks[0]
  await app(`/exam/mock/${m.id}`, 'h1')
  await page.getByRole('button', { name: /Start the exam/ }).click()
  await page.waitForSelector('[role="grid"]')
  await page.waitForTimeout(300)
  for (const [i, q] of m.questions.entries()) {
    await openQuestion(i)
    expect((await overflowX()) <= 1, `${q.id} running scrolls sideways by ${await overflowX()}px`)
    await inViewportX(page.getByRole('timer'), 'timer')
    await inViewportX(page.getByRole('button', { name: 'Submit', exact: true }), 'Submit button')
    await inViewportX(tab(i), `tab Q${i + 1}`)
    expect((await cards().count()) === q.tasks.length, `${q.id}: ${await cards().count()} cards on the phone`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await shot(`${m.id}-exam-q${i + 1}`)
    // the second task opens in full; its "Go to the sheet" button brings the grid into view
    await cards().nth(1).locator('button').first().click()
    await page.waitForTimeout(200)
    await shot(`${m.id}-exam-q${i + 1}-task2`)
    const go = cards().nth(1).getByRole('button', { name: 'Go to the sheet' })
    if (await go.count()) {
      await go.click()
      await page.waitForTimeout(700)
      await inViewportX(page.locator('section[aria-label="Spreadsheet"]'), 'spreadsheet')
      await shot(`${m.id}-exam-q${i + 1}-sheet`)
    }
  }
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await confirmDialog('Submit')
  await page.getByText(/^Submitted$/).waitFor({ timeout: 120000 })
  await page.evaluate(() => window.scrollTo(0, 0))
  expect((await overflowX()) <= 1, `review scrolls sideways by ${await overflowX()}px`)
  await inViewportX(page.getByRole('button', { name: 'Retake' }), 'Retake button')
  await shot(`${m.id}-review`)
  await shot(`${m.id}-review-full`, { fullPage: true })
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
