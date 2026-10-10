// browser QA for the lab player, dialogs, catalogue, sandbox and mock exams: node scripts/qa-player.mjs
// starts its own vite dev server on :4622: hot reload off (other agents' edits cannot reload the page mid-test) and its
// own dependency cache (other dev servers re-optimising node_modules/.vite cannot invalidate it). REUSE=1 uses a server
// already on PORT instead. ONLY=<regex> runs a subset. Screenshots: /tmp/cs602_player (1280 and 390px); server log in
// /tmp/cs602_player/vite.log
import { chromium } from 'playwright-core'
import { createServer, createLogger } from 'vite'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'

const PORT = process.env.PORT ?? '4622'
const ORIGIN = `http://localhost:${PORT}`
const HARNESS = `${ORIGIN}/CS602/dev/player-harness.html`
const APP = `${ORIGIN}/CS602/#`
const SHOTS = process.env.SHOTS ?? '/tmp/cs602_player'
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null
mkdirSync(SHOTS, { recursive: true })

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function up() {
  try {
    return (await fetch(`${ORIGIN}/CS602/`)).ok
  } catch {
    return false
  }
}

let server = null
if (process.env.REUSE !== '1') {
  if (await up()) {
    console.error(`port ${PORT} is already in use: stop that server, or run with REUSE=1 to test against it`)
    process.exit(2)
  }
  const LOG = `${SHOTS}/vite.log`
  writeFileSync(LOG, '')
  const logger = createLogger('info')
  for (const level of ['info', 'warn', 'error']) {
    logger[level] = msg => appendFileSync(LOG, `${new Date().toISOString().slice(11, 19)} ${level} ${msg}\n`)
  }
  server = await createServer({
    root: new URL('..', import.meta.url).pathname,
    cacheDir: `${SHOTS}/.vite`,
    server: { port: Number(PORT), strictPort: true, hmr: false },
    optimizeDeps: { entries: ['index.html', 'dev/player-harness.html'] },
    customLogger: logger,
  })
  await server.listen()
  for (let i = 0; i < 40 && !(await up()); i++) await sleep(250)
}
const stopServer = () => server?.close()

// ---------- refs ----------
const colNum = s => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
const colName = i => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
const cellOf = ref => {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref.trim().toUpperCase())
  return m ? { r: Number(m[2]) - 1, c: colNum(m[1]) } : null
}
const box = range => {
  const [a, b = a] = range.split(',')[0].split(':')
  const p = cellOf(a)
  const q = cellOf(b)
  return p && q ? { r1: Math.min(p.r, q.r), c1: Math.min(p.c, q.c), r2: Math.max(p.r, q.r), c2: Math.max(p.c, q.c) } : null
}
const refOf = (r, c) => `${colName(c)}${r + 1}`
const firstCell = range => {
  const b = box(range)
  return b ? refOf(b.r1, b.c1) : 'A1'
}
const cellCount = range => range.split(',').reduce((n, part) => {
  const b = box(part)
  return n + (b ? (b.r2 - b.r1 + 1) * (b.c2 - b.c1 + 1) : 0)
}, 0)
const norm = s => String(s ?? '').replace(/\s+/g, '').toUpperCase()

// ---------- runner ----------
const results = []
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg)
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('console', m => {
  if (m.type() === 'error') errors.push(`${page.url().replace(ORIGIN, '')} :: ${m.text()}`)
})
page.on('pageerror', e => errors.push(`${page.url().replace(ORIGIN, '')} :: ${e}`))

const width = () => page.viewportSize()?.width ?? 0
const shot = async name => page.screenshot({ path: `${SHOTS}/${name}-${width()}.png` })
const notes = []
const note = s => notes.push(s)

async function check(name, fn) {
  if (ONLY && !ONLY.test(name)) return
  const t0 = Date.now()
  try {
    await fn()
    results.push({ ok: true, name, ms: Date.now() - t0 })
  } catch (e) {
    results.push({ ok: false, name, ms: Date.now() - t0, error: String(e.message ?? e).split('\n')[0] })
    await shot(`FAIL-${slug(name)}`).catch(() => undefined)
  }
}

// ---------- page helpers ----------
async function harness(query, waitFor = '[role="grid"]') {
  await page.goto(`${HARNESS}?${query}`)
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 30000 })
  await page.waitForTimeout(200)
}
async function app(path, waitFor) {
  await page.goto(`${APP}${path}`)
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 30000 })
  await page.waitForTimeout(200)
}
const clearStorage = () => page.evaluate(() => localStorage.clear())

const nameBox = () => page.getByLabel('Name box', { exact: true })
const formulaBar = () => page.getByLabel('Formula bar', { exact: true })
const toolbar = () => page.getByRole('toolbar', { name: 'Spreadsheet tools' })
const tool = label => toolbar().getByRole('button', { name: label, exact: true })
const cards = () => page.locator('aside[aria-label="Tasks"] article')
const statusBar = () => page.getByRole('status', { name: 'Status bar' })

async function select(ref) {
  await nameBox().click()
  await nameBox().fill(ref)
  await nameBox().press('Enter')
  await page.waitForTimeout(60)
}
async function enter(ref, text) {
  await select(ref)
  await page.keyboard.type(text, { delay: 4 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(80)
}
async function formulaOf(ref) {
  await select(ref)
  return formulaBar().inputValue()
}
async function cellText(ref) {
  const p = cellOf(ref)
  await select(ref)
  return (await page.locator(`[role="grid"] [id$="-r${p.r}c${p.c}"]`).first().innerText()).trim()
}
async function runCheck() {
  await tool('Check').click()
  await page.waitForFunction(
    () => ![...document.querySelectorAll('[role="toolbar"] button')].some(b => (b.textContent ?? '').includes('Checking')),
    null, { timeout: 60000 },
  )
  await page.waitForTimeout(150)
}
const statusOf = async i => {
  const card = cards().nth(i)
  for (const label of ['Correct', 'Not yet correct', 'Waiting for your self-mark', 'Solved on an earlier visit']) {
    if (await card.locator(`[aria-label="${label}"]`).count()) return label
  }
  return 'unchecked'
}
const messagesOf = async i => (await cards().nth(i).locator('ul li').allInnerTexts()).map(s => s.trim()).filter(Boolean)
async function confirmDialog(button) {
  const dlg = page.getByRole('alertdialog')
  await dlg.waitFor()
  await dlg.getByRole('button', { name: button, exact: true }).click()
  await dlg.waitFor({ state: 'detached' })
}
const dialog = title => page.getByRole('dialog', { name: title, exact: true })
async function fillField(scope, label, value) {
  const f = scope.getByLabel(label, { exact: true })
  await f.fill(String(value))
}

// solve one task through the ui (formula/value/criteria typed; tools through their dialogs; explain self-marked)
async function solveTask(ex, t, { exam = false } = {}) {
  const index = ex.tasks.indexOf(t)
  if (t.kind === 'formula' || t.kind === 'criteria' || t.kind === 'value') {
    if (t.solutions) {
      for (const [ref, v] of Object.entries(t.solutions)) await enter(ref, String(v))
      return
    }
    if (t.kind === 'value') {
      const answer = t.answer && typeof t.answer === 'object' ? t.answer : { [firstCell(t.cells)]: t.answer }
      for (const [ref, v] of Object.entries(answer)) await enter(ref, String(v))
      return
    }
    const b = box(t.cells)
    await enter(refOf(b.r1, b.c1), t.solution)
    if (b.c2 > b.c1) {
      await select(`${refOf(b.r1, b.c1)}:${refOf(b.r1, b.c2)}`)
      await tool('Fill Right').click()
    }
    if (b.r2 > b.r1) {
      await select(t.cells.split(',')[0])
      await tool('Fill Down').click()
    }
    return
  }
  if (t.kind === 'explain') {
    const card = cards().nth(index)
    await card.locator('textarea').fill('The anchored part must not move when the formula is filled, so it keeps its $.')
    if (exam) return
    await card.getByRole('button', { name: 'Show model answer' }).click()
    await card.getByRole('button', { name: 'Got it' }).click()
    return
  }
  if (t.kind === 'tool' && t.tool === 'goalseek') return goalSeek(t.toolSetup)
  if (t.kind === 'tool' && t.tool === 'datatable') return dataTable(t.toolSetup)
  if (t.kind === 'tool' && t.tool === 'solver') return solver(t.toolSetup)
  throw new Error(`no ui path for ${t.kind}/${t.tool ?? ''}`)
}
const typed = t => (t.kind === 'formula' || t.kind === 'value') && (t.solution || t.solutions || t.answer !== undefined)
async function solveTyped(ex, except) {
  for (const t of ex.tasks) if (t !== except && typed(t)) await solveTask(ex, t)
}
async function allStatuses(ex) {
  const out = []
  for (let i = 0; i < ex.tasks.length; i++) out.push(await statusOf(i))
  return out
}
async function explainFailures(ex, statuses) {
  const bad = []
  for (let i = 0; i < ex.tasks.length; i++) {
    if (statuses[i] !== 'Correct') bad.push(`${ex.tasks[i].id}: ${statuses[i]} ${(await messagesOf(i)).join(' / ')}`)
  }
  return bad.join(' | ')
}

async function goalSeek(setup, { viaCard } = {}) {
  if (viaCard) await viaCard.getByRole('button', { name: 'Open Goal Seek' }).click()
  else {
    await toolbar().getByRole('button', { name: 'What-If Analysis' }).click()
    await page.getByRole('menuitem', { name: 'Goal Seek…' }).click()
  }
  const dlg = dialog('Goal Seek')
  await dlg.waitFor()
  await fillField(dlg, 'Set cell:', setup.setCell)
  await fillField(dlg, 'To value:', setup.toValue)
  await fillField(dlg, 'By changing cell:', setup.changingCell)
  await shot('goalseek-dialog')
  await dlg.getByRole('button', { name: 'OK', exact: true }).click()
  const status = dialog('Goal Seek Status')
  await status.waitFor({ timeout: 20000 })
  await shot('goalseek-status')
  await status.getByRole('button', { name: 'OK', exact: true }).click()
  await status.waitFor({ state: 'detached' })
}

async function dataTable(setup) {
  await select(setup.range)
  await toolbar().getByRole('button', { name: 'What-If Analysis' }).click()
  await page.getByRole('menuitem', { name: 'Data Table…' }).click()
  const dlg = dialog('Data Table')
  await dlg.waitFor()
  const range = await dlg.getByLabel('Table range (the selection):', { exact: true }).inputValue()
  expect(norm(range) === norm(setup.range), `table range "${range}" not prefilled from the selection ${setup.range}`)
  if (setup.rowInput) await fillField(dlg, 'Row input cell:', setup.rowInput)
  if (setup.colInput) await fillField(dlg, 'Column input cell:', setup.colInput)
  await shot('datatable-dialog')
  await dlg.getByRole('button', { name: 'OK', exact: true }).click()
  await dlg.waitFor({ state: 'detached', timeout: 20000 })
}

async function solver(setup) {
  await tool('Solver').click()
  const dlg = dialog('Solver Parameters')
  await dlg.waitFor()
  await fillField(dlg, 'Set Objective:', setup.objective)
  await dlg.getByLabel(setup.sense === 'max' ? 'Max' : setup.sense === 'min' ? 'Min' : 'Value Of:', { exact: true }).check()
  if (setup.sense === 'value') await fillField(dlg, 'Value of', setup.valueOf)
  await fillField(dlg, 'By Changing Variable Cells:', setup.changing)
  for (const c of setup.constraints ?? []) {
    await dlg.getByRole('button', { name: 'Add', exact: true }).first().click()
    const ed = dlg.getByRole('group', { name: 'Add Constraint' })
    await ed.waitFor()
    await fillField(ed, 'Cell Reference:', c.lhs)
    await ed.getByLabel('Relation', { exact: true }).selectOption(c.relation)
    if (c.relation !== 'int' && c.relation !== 'bin') await fillField(ed, 'Constraint:', c.rhs)
    await ed.getByRole('button', { name: 'OK', exact: true }).click()
    await ed.waitFor({ state: 'detached' })
  }
  await dlg.getByLabel('Make Unconstrained Variables Non-Negative', { exact: true }).setChecked(setup.nonNegative ?? true)
  await dlg.getByLabel('Select a Solving Method:', { exact: true }).selectOption(setup.engine ?? 'simplex')
  await shot('solver-parameters')
  await dlg.getByRole('button', { name: 'Solve', exact: true }).click()
  const res = dialog('Solver Results')
  await res.waitFor({ timeout: 30000 })
  await shot('solver-results')
  await res.getByRole('button', { name: 'OK', exact: true }).click()
  await res.waitFor({ state: 'detached' })
}

// ---------- fixtures ----------
await harness('view=list', 'h1')
const fx = await page.evaluate(() => window.__harness)
expect(fx && fx.exercises.length > 0, 'harness exposes no fixture exercises')
const all = fx.exercises
note(`fixtures: ${all.map(e => `${e.id}[${e.tasks.map(t => t.kind + (t.tool ? `:${t.tool}` : '')).join(',')}]`).join(' ')}; mock ${fx.mock.id}`)

const plainFormula = t => t.kind === 'formula' && !t.random && (t.solution || t.solutions)
const uiSolvable = t => typed(t) || t.kind === 'explain' || (t.kind === 'tool' && ['goalseek', 'datatable', 'solver'].includes(t.tool) && t.toolSetup)
// the exercise with the most fill work whose tasks can all be answered from the keyboard
const formulaEx = all
  .filter(e => e.tasks.length && e.tasks.every(t => typed(t) || t.kind === 'explain') && e.tasks.some(plainFormula))
  .sort((a, b) => Math.max(...b.tasks.map(t => cellCount(t.cells || 'A1'))) - Math.max(...a.tasks.map(t => cellCount(t.cells || 'A1'))))[0]
const hintsEx = fx.extras.find(e => e.tasks.some(t => t.hints?.length)) ?? all.find(e => e.tasks.some(t => t.hints?.length))
const toolEx = name => all.find(e => e.tasks.some(t => t.kind === 'tool' && t.tool === name && t.toolSetup) && e.tasks.every(uiSolvable))
const goalEx = toolEx('goalseek')
const dtEx = all.find(e => e.tasks.some(t => t.tool === 'datatable' && !t.random && t.toolSetup?.colInput && !t.toolSetup.rowInput) && e.tasks.every(uiSolvable))
const mcEx = all.find(e => e.tasks.some(t => t.tool === 'datatable' && t.random) && e.tasks.every(uiSolvable))
const solverEx = toolEx('solver')

// ---------- player ----------
await check('formula exercise: a wrong answer gets a specific message', async () => {
  expect(formulaEx, 'no fixture exercise answered by typing')
  await harness('view=list', 'h1')
  await clearStorage()
  await harness(`id=${encodeURIComponent(formulaEx.id)}`)
  await shot('player-start')
  const i = formulaEx.tasks.findIndex(plainFormula)
  const t = formulaEx.tasks[i]
  const wrong = t.wrong?.[0] ?? '12345'
  await enter(firstCell(t.cells), wrong)
  await runCheck()
  expect(await statusOf(i) === 'Not yet correct', `task ${i + 1} not marked wrong after "${wrong}"`)
  const msgs = await messagesOf(i)
  expect(msgs.length > 0 && msgs.every(m => m.length > 12), `no specific message: ${JSON.stringify(msgs)}`)
  expect(!msgs.some(m => norm(m).includes(norm(t.solution ?? '##'))), 'the message gives the solution away')
  note(`wrong "${wrong}" -> ${msgs.join(' | ')}`)
  await shot('formula-wrong')
})

await check('formula exercise: solved by typing + fill gets every tick', async () => {
  expect(formulaEx, 'no fixture exercise answered by typing')
  for (const t of formulaEx.tasks) await solveTask(formulaEx, t)
  await runCheck()
  const got = await allStatuses(formulaEx)
  expect(got.every(s => s === 'Correct'), await explainFailures(formulaEx, got))
  const summary = await toolbar().innerText()
  expect(new RegExp(`${formulaEx.tasks.length}/${formulaEx.tasks.length} correct`).test(summary), `toolbar score: ${summary}`)
  expect(/All \d+ tasks correct/.test(await statusBar().innerText()), 'status bar has no score line')
  await shot('formula-solved')
})

await check('formula exercise: progress survives a reload', async () => {
  expect(formulaEx, 'no fixture exercise answered by typing')
  await page.waitForTimeout(700)   // debounce
  await page.reload()
  await page.waitForSelector('[role="grid"]')
  await page.waitForTimeout(200)
  const t = formulaEx.tasks.find(plainFormula)
  const ref = t.solutions ? Object.keys(t.solutions)[0] : firstCell(t.cells)
  const want = t.solutions ? t.solutions[ref] : t.solution
  const raw = await formulaOf(ref)
  expect(norm(raw) === norm(want), `${ref} holds "${raw}" after reload, expected "${want}"`)
  expect(await statusOf(formulaEx.tasks.indexOf(t)) === 'Solved on an earlier visit', 'solved task not flagged after reload')
  const explain = formulaEx.tasks.find(x => x.kind === 'explain')
  if (explain) expect((await cards().nth(formulaEx.tasks.indexOf(explain)).locator('textarea').inputValue()).length > 10, 'explain note lost')
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem(`cs602-lab:${id}`) ?? 'null'), formulaEx.id)
  expect(saved && saved.solved.length === formulaEx.tasks.length && saved.best === 1, `progress not stored: ${JSON.stringify(saved)?.slice(0, 200)}`)
})

await check('reset then reveal writes the reference and ticks the task', async () => {
  expect(formulaEx, 'no fixture exercise answered by typing')
  await tool('Reset').click()
  await confirmDialog('Reset')
  await page.waitForTimeout(300)
  const t = formulaEx.tasks.find(plainFormula)
  const i = formulaEx.tasks.indexOf(t)
  const ref = t.solutions ? Object.keys(t.solutions)[0] : firstCell(t.cells)
  expect((await formulaOf(ref)) === '', `${ref} not cleared by Reset`)
  expect(await statusOf(i) === 'unchecked', `after reset task shows ${await statusOf(i)}`)
  await cards().nth(i).getByRole('button', { name: /^Reveal/ }).click()
  await confirmDialog('Reveal')
  await page.waitForTimeout(500)
  expect(await statusOf(i) === 'Correct', `revealed task shows ${await statusOf(i)}`)
  const raw = await formulaOf(ref)
  expect(norm(raw) === norm(t.solutions ? t.solutions[ref] : t.solution), `reveal wrote "${raw}"`)
  await shot('reveal')
})

await check('hints are progressive, explanations follow a reveal, function chips open a syntax card', async () => {
  expect(hintsEx, 'no exercise with hints')
  await harness(`id=${encodeURIComponent(hintsEx.id)}`)
  const i = hintsEx.tasks.findIndex(t => (t.hints?.length ?? 0) > 1)
  const card = cards().nth(i)
  await card.getByRole('button', { name: /^Hint/ }).click()
  expect(await card.getByText('Hint 1:').count() === 1, 'first hint not shown')
  await card.getByRole('button', { name: /^Next hint/ }).click()
  expect(await card.getByText('Hint 2:').count() === 1, 'second hint not shown')
  expect(await card.getByRole('button', { name: 'No more hints' }).isDisabled(), 'hint button not exhausted')
  const chip = card.locator('button[aria-haspopup="dialog"]').first()
  expect(await chip.count(), 'no function chip in the hints')
  const name = (await chip.innerText()).trim()
  await chip.click()
  const pop = page.getByRole('dialog', { name, exact: true })
  await pop.waitFor()
  expect((await pop.innerText()).includes(`=${name}(`), 'syntax card shows no syntax')
  await shot('function-card')
  await page.keyboard.press('Escape')
  await pop.waitFor({ state: 'detached' })
  await card.getByRole('button', { name: /^Reveal/ }).click()
  await confirmDialog('Reveal')
  await page.waitForTimeout(400)
  const why = hintsEx.tasks[i].explain
  expect((await cards().nth(i).innerText()).includes(why.slice(0, 30)), 'no explanation after reveal')
  await shot('hints-reveal')
})

// ---------- what-if tools through their dialogs ----------
await check('goal seek through the dialog (task card button) solves the task', async () => {
  expect(goalEx, 'no fixture goal seek exercise')
  await harness(`id=${encodeURIComponent(goalEx.id)}`)
  const t = goalEx.tasks.find(x => x.tool === 'goalseek')
  const i = goalEx.tasks.indexOf(t)
  await solveTyped(goalEx, t)
  await goalSeek(t.toolSetup, { viaCard: cards().nth(i) })
  expect(/Goal Seek found a solution/.test(await statusBar().innerText()), `status: ${await statusBar().innerText()}`)
  await runCheck()
  const got = await allStatuses(goalEx)
  expect(got.every(s => s === 'Correct'), await explainFailures(goalEx, got))
  await shot('goalseek-done')
})

await check('goal seek cancel restores the changing cell', async () => {
  expect(goalEx, 'no fixture goal seek exercise')
  await harness('view=list', 'h1')
  await clearStorage()
  await harness(`id=${encodeURIComponent(goalEx.id)}`)
  const t = goalEx.tasks.find(x => x.tool === 'goalseek')
  await solveTyped(goalEx, t)
  const s = t.toolSetup
  const before = await formulaOf(s.changingCell)
  await toolbar().getByRole('button', { name: 'What-If Analysis' }).click()
  await page.getByRole('menuitem', { name: 'Goal Seek…' }).click()
  const dlg = dialog('Goal Seek')
  await fillField(dlg, 'Set cell:', s.setCell)
  await fillField(dlg, 'To value:', s.toValue)
  await fillField(dlg, 'By changing cell:', s.changingCell)
  await dlg.getByRole('button', { name: 'OK', exact: true }).click()
  const status = dialog('Goal Seek Status')
  await status.waitFor()
  await status.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await formulaOf(s.changingCell)) === before, 'changing cell not restored')
  expect(/cancelled/.test(await statusBar().innerText()), `status: ${await statusBar().innerText()}`)
})

await check('data tables (one and two variables) through the dialog solve the tasks; F9 hint after edits', async () => {
  expect(dtEx, 'no fixture data table exercise')
  await harness(`id=${encodeURIComponent(dtEx.id)}`)
  await solveTyped(dtEx)
  for (const t of dtEx.tasks) if (t.tool === 'datatable') await dataTable(t.toolSetup)
  expect(/Data table .* filled/.test(await statusBar().innerText()), `status: ${await statusBar().innerText()}`)
  await runCheck()
  const got = await allStatuses(dtEx)
  expect(got.every(s => s === 'Correct'), await explainFailures(dtEx, got))
  await shot('datatable-done')
  // an edit makes the tables stale until F9
  const input = Object.entries(dtEx.sheet.cells).find(([, c]) => c.role === 'input' && typeof c.v === 'number')
  expect(input, 'no numeric input cell')
  await enter(input[0], String(input[1].v * 2))
  expect(await page.getByText('Data tables are not recalculated automatically: press F9').count() === 1, 'no F9 hint after an edit')
  await shot('datatable-f9-hint')
  await page.keyboard.press('F9')
  await page.waitForTimeout(200)
  expect(await page.getByText('Data tables are not recalculated automatically: press F9').count() === 0, 'F9 hint stays after F9')
  await enter(input[0], String(input[1].v))
})

await check('monte carlo: random formulas and a replication table on a blank input cell', async () => {
  expect(mcEx, 'no fixture monte carlo exercise')
  await harness(`id=${encodeURIComponent(mcEx.id)}`)
  for (const t of mcEx.tasks) if (t.kind === 'formula' && t.solution) await solveTask(mcEx, t)
  for (const t of mcEx.tasks) if (t.tool === 'datatable') await dataTable(t.toolSetup)
  await runCheck()
  const got = await allStatuses(mcEx)
  expect(got.every(s => s === 'Correct'), await explainFailures(mcEx, got))
  await shot('montecarlo-done')
})

await check('solver through the dialog solves the task', async () => {
  expect(solverEx, 'no fixture solver exercise')
  await harness(`id=${encodeURIComponent(solverEx.id)}`)
  const t = solverEx.tasks.find(x => x.tool === 'solver')
  await solveTyped(solverEx, t)
  await solver(t.toolSetup)
  expect(/Solver: solution kept/.test(await statusBar().innerText()), `status: ${await statusBar().innerText()}`)
  await runCheck()
  const got = await allStatuses(solverEx)
  expect(got.every(s => s === 'Correct'), await explainFailures(solverEx, got))
  await shot('solver-done')
})

await check('every fixture exercise opens cleanly with exactly the tools it needs', async () => {
  const before = errors.length
  const labels = { goalseek: 'What-If Analysis', datatable: 'What-If Analysis', solver: 'Solver', sort: 'Sort', autofilter: 'Filter', advfilter: 'Advanced', pivot: 'PivotTable' }
  for (const ex of all) {
    await harness(`id=${encodeURIComponent(ex.id)}`)
    const need = new Set(ex.tasks.map(t => labels[t.tool ?? (t.kind === 'criteria' ? 'advfilter' : '')]).filter(Boolean))
    for (const label of new Set(Object.values(labels))) {
      const n = await toolbar().getByRole('button', { name: label, exact: true }).count()
      expect(n === (need.has(label) ? 1 : 0), `${ex.id}: ${label} button ${n ? 'shown' : 'missing'}`)
    }
    expect(await tool('VBA').count() === (ex.tasks.some(t => t.kind === 'vba') ? 1 : 0), `${ex.id}: VBA button mismatch`)
  }
  expect(errors.length === before, `console errors: ${errors.slice(before).join(' || ')}`)
})

await check('criteria task: a typed criteria range passes; the Advanced Filter dialog opens from the toolbar', async () => {
  const ex = all.find(e => e.tasks.some(t => t.kind === 'criteria' && t.solutions))
  expect(ex, 'no fixture criteria task')
  await harness(`id=${encodeURIComponent(ex.id)}`)
  for (const t of ex.tasks) if (t.kind === 'criteria') await solveTask(ex, t)
  await runCheck()
  const got = await allStatuses(ex)
  expect(got.every(s => s === 'Correct'), await explainFailures(ex, got))
  await tool('Advanced').click()
  const dlg = dialog('Advanced Filter')
  await dlg.waitFor()
  await shot('advanced-filter-dialog')
  await page.keyboard.press('Escape')
  await dlg.waitFor({ state: 'detached' })
})

await check('vba task opens the editor docked under the grid with the starter code', async () => {
  const ex = all.find(e => e.tasks.some(t => t.kind === 'vba'))
  expect(ex, 'no fixture vba task')
  await harness(`id=${encodeURIComponent(ex.id)}`)
  const t = ex.tasks.find(x => x.kind === 'vba')
  await cards().nth(ex.tasks.indexOf(t)).getByRole('button', { name: 'Open VBA editor' }).click()
  await page.waitForTimeout(300)
  const text = await page.locator('section[aria-label="Spreadsheet"]').innerText()
  const code = await page.locator('section[aria-label="Spreadsheet"] textarea').first().inputValue().catch(() => '')
  expect(norm(text + code).includes(norm(t.vba.starter.split('\n')[0])), 'starter code not shown')
  await shot('vba-panel')
})

// ---------- catalogue ----------
await check('catalogue (fixtures) renders, groups by week and filters', async () => {
  await harness('view=catalogue', 'h1')
  const cardsOn = () => page.locator('main a[href^="#/lab/"]:not([href="#/lab/sandbox"])')
  expect(await cardsOn().count() === all.length, `${await cardsOn().count()} cards for ${all.length} fixtures`)
  await shot('catalogue')
  const week = all.find(e => e.week !== 'EXAM')?.week
  if (week) {
    await page.getByRole('group', { name: 'Week' }).getByRole('button', { name: week, exact: true }).click()
    await page.waitForTimeout(150)
    const want = all.filter(e => e.week === week).length
    expect(await cardsOn().count() === want, `week ${week}: ${await cardsOn().count()} cards, expected ${want}`)
    expect(page.url().includes(`week=${week}`), `url has no week param: ${page.url()}`)
    await page.getByRole('group', { name: 'Week' }).getByRole('button', { name: 'All weeks' }).click()
  }
  const target = all[all.length - 1]
  await page.getByLabel('Search exercises').fill(target.title)
  await page.waitForTimeout(150)
  const n = await cardsOn().count()
  expect(n >= 1 && n < all.length + 1, `search "${target.title}" -> ${n}`)
  await page.getByLabel('Search exercises').fill('zzzz-no-such-exercise')
  expect(await page.getByText('No exercises match these filters.').count() === 1, 'no empty state')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  expect(await cardsOn().count() === all.length, 'clear filters')
  const tech = all.flatMap(e => e.techniques ?? [])[0]
  if (tech) {
    await page.goto(`${HARNESS}?view=catalogue#/?technique=${encodeURIComponent(tech)}`)
    await page.waitForSelector('h1')
    const want = all.filter(e => (e.techniques ?? []).includes(tech)).length
    expect(await cardsOn().count() === want, `technique filter: ${await cardsOn().count()} vs ${want}`)
    expect(await page.getByLabel('Clear technique filter').count() === 1, 'technique chip missing')
  } else note('no fixture has techniques: technique filter not exercised')
})

await check('lab pages: catalogue, unknown exercise and unknown mock', async () => {
  await app('/lab', 'h1')
  expect((await page.locator('h1').innerText()).includes('Excel Lab'), 'no Excel Lab heading')
  expect(await page.locator('a[href="#/lab/sandbox"]').count() >= 1, 'no sandbox card')
  expect(await page.locator('a[href="#/exam"]').count() >= 1, 'no mock exam link')
  await shot('lab-catalogue-real')
  await app('/lab?week=W3', 'h1')
  await app('/lab/no-such-exercise', 'h1')
  expect(await page.getByText('Exercise not found').count() === 1, 'no not-found state')
  await app('/exam/mock/no-such-mock', 'h1')
  expect(await page.getByText('Mock exam not found').count() === 1, 'no mock not-found state')
  const first = await page.evaluate(async () => {
    const m = await import('/CS602/src/data/lab/index.ts')
    return { ex: m.exercises[0]?.id ?? null, n: m.exercises.length, mock: m.mocks[0]?.id ?? null }
  })
  note(`real data: ${first.n} exercises, first mock ${first.mock}`)
  if (first.ex) {
    await app(`/lab/${first.ex}`, '[role="grid"]')
    await shot('lab-player-real')
  }
  if (first.mock) {
    await app(`/exam/mock/${first.mock}`, 'h1')
    expect(await page.getByRole('button', { name: /Start the exam/ }).count() === 1, 'real mock intro has no Start')
  }
})

await check('real exercises: each opens cleanly; revealing every task then Check ticks them all', async () => {
  await app('/lab', 'h1')
  const real = await page.evaluate(async () => {
    const m = await import('/CS602/src/data/lab/index.ts')
    return m.exercises.map(e => ({ id: e.id, tasks: e.tasks.map(t => ({ id: t.id, kind: t.kind })) }))
  })
  if (!real.length) {
    note('no real exercises yet')
    return
  }
  const before = errors.length
  const bad = []
  for (const ex of real) {
    await app(`/lab/${ex.id}`, '[role="grid"]')
    if ((await cards().count()) !== ex.tasks.length) bad.push(`${ex.id}: ${await cards().count()} cards`)
    for (let i = 0; i < ex.tasks.length; i++) {
      const card = cards().nth(i)
      await card.locator('button').first().click()
      if (ex.tasks[i].kind === 'explain') {
        await card.getByRole('button', { name: 'Show model answer' }).click()
        await card.getByRole('button', { name: 'Got it' }).click()
        continue
      }
      await card.getByRole('button', { name: /^Reveal/ }).click()
      await confirmDialog('Reveal')
      await page.waitForTimeout(150)
    }
    await runCheck()
    const got = await allStatuses(ex)
    if (!got.every(x => x === 'Correct')) bad.push(`${ex.id}: ${await explainFailures(ex, got)}`)
  }
  note(`real exercises revealed and checked: ${real.length}`)
  expect(bad.length === 0, bad.join(' || '))
  expect(errors.length === before, `console errors: ${errors.slice(before).join(' || ')}`)
})

// ---------- sandbox ----------
await check('sandbox (/lab/sandbox): every tool, formulas, status bar stats, persistence, reset', async () => {
  await app('/lab', 'h1')
  await clearStorage()
  await app('/lab/sandbox', '[role="grid"]')
  for (const label of ['Solver', 'Sort', 'Filter', 'Advanced', 'PivotTable', 'VBA', 'What-If Analysis', 'Iterative', 'Calculate Now', 'Fill Down', 'Fill Right', 'Undo', 'Redo', 'Reset']) {
    expect(await toolbar().getByRole('button', { name: label, exact: true }).count() === 1, `sandbox toolbar lacks ${label}`)
  }
  expect(await tool('Check').count() === 0, 'sandbox shows Check')
  // the decision-tool dialogs mount from the toolbar and close with Esc
  for (const [label, title] of [['Sort', 'Sort'], ['Filter', 'Filter (AutoFilter)'], ['Advanced', 'Advanced Filter'], ['PivotTable', 'PivotTable']]) {
    await tool(label).click()
    const dlg = dialog(title)
    await dlg.waitFor({ timeout: 5000 })
    await page.keyboard.press('Escape')
    await dlg.waitFor({ state: 'detached', timeout: 5000 })
  }
  await enter('A1', '5')
  await enter('A2', '7')
  await enter('A3', '=A1+A2')
  expect((await cellText('A3')) === '12', `A3 shows ${await cellText('A3')}`)
  await select('A1:A3')
  const stats = await page.getByLabel('Selection statistics').innerText()
  expect(/Sum:\s*24/.test(stats) && /Count:\s*3/.test(stats) && /Average:\s*8/.test(stats), `status bar stats: ${stats}`)
  // number format menu
  await select('A1')
  await toolbar().getByRole('button', { name: /^Number format/ }).click()
  await page.getByRole('menuitem', { name: /^Currency/ }).click()
  expect((await cellText('A1')).includes('$5.00'), `currency format: ${await cellText('A1')}`)
  await tool('Undo').click()
  await tool('VBA').click()
  await page.waitForTimeout(200)
  expect(await page.locator('section[aria-label="Spreadsheet"] textarea, section[aria-label="Spreadsheet"] [contenteditable="true"]').count() >= 1, 'VBA editor not docked')
  await shot('sandbox')
  await tool('VBA').click()
  await page.waitForTimeout(700)
  await page.reload()
  await page.waitForSelector('[role="grid"]')
  expect((await formulaOf('A3')) === '=A1+A2', 'sandbox not restored after reload')
  await tool('Reset').click()
  await confirmDialog('Clear')
  await page.waitForTimeout(300)
  expect((await formulaOf('A3')) === '', 'sandbox not cleared')
})

// ---------- mock exam ----------
await check('mock exam: start, answer, timer survives reload, submit, score, review self-mark, retake', async () => {
  await harness('view=list', 'h1')
  await clearStorage()
  await harness('view=mock', 'h1')
  const mock = fx.mock
  expect(mock.questions.length >= 1, 'fixture mock has no questions')
  await shot('mock-intro')
  await page.getByRole('button', { name: /Start the exam/ }).click()
  await page.waitForSelector('[role="grid"]')
  expect(await page.getByRole('timer').count() === 1, 'no timer')
  expect(await tool('Check').count() === 0, 'Check visible during the exam')
  expect(await page.getByRole('button', { name: /^Hint/ }).count() === 0, 'Hint visible during the exam')
  expect(await page.getByRole('button', { name: /^Reveal/ }).count() === 0, 'Reveal visible during the exam')
  let expectGot = 0
  let explainMarks = 0
  for (const [qi, q] of mock.questions.entries()) {
    await page.getByRole('tab', { name: new RegExp(`^Q${qi + 1}\\b`) }).click()
    await page.waitForSelector('[role="grid"]')
    await page.waitForTimeout(200)
    for (const t of q.exercise.tasks) {
      if (typed(t)) {
        await solveTask(q.exercise, t)
        expectGot += t.marks ?? 0
      } else if (t.kind === 'explain') {
        await solveTask(q.exercise, t, { exam: true })
        explainMarks += t.marks ?? 0
      }
    }
    if (qi === 0) await shot('mock-running')
  }
  const q1 = mock.questions[0].exercise
  const t1 = q1.tasks.find(plainFormula)
  await page.getByRole('tab', { name: /^Q1\b/ }).click()
  await page.waitForSelector('[role="grid"]')
  if (t1) expect(norm(await formulaOf(firstCell(t1.cells))) === norm(t1.solution), 'Q1 answer lost after switching tabs')
  await page.waitForTimeout(700)
  const left1 = (await page.getByRole('timer').innerText()).trim()
  await page.reload()
  await page.waitForSelector('[role="timer"]', { timeout: 20000 })
  await page.waitForSelector('[role="grid"]')
  if (t1) expect(norm(await formulaOf(firstCell(t1.cells))) === norm(t1.solution), 'Q1 answer lost after reload')
  note(`timer before/after reload: ${left1} / ${(await page.getByRole('timer').innerText()).trim()}`)
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await confirmDialog('Submit')
  await page.getByText(/^Submitted$/).waitFor({ timeout: 60000 })
  const total = async () => {
    const m = /(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/.exec(await page.locator('section[aria-label="Result"] p.text-3xl').innerText())
    expect(m, 'no total score')
    return [Number(m[1]), Number(m[2])]
  }
  const [got, max] = await total()
  const marksMax = mock.questions.reduce((n, q) => n + q.marks, 0)
  expect(max === marksMax, `max ${max} != ${marksMax}`)
  expect(got === expectGot, `score ${got}, expected ${expectGot} (every typed task right, written answers pending)`)
  note(`mock score at submit ${got}/${max}`)
  expect(await tool('Check').count() === 1, 'review mode has no Check')
  await shot('mock-review')
  if (explainMarks) {
    for (const [qi, q] of mock.questions.entries()) {
      const ex = q.exercise
      if (!ex.tasks.some(t => t.kind === 'explain')) continue
      await page.getByRole('tab', { name: new RegExp(`^Q${qi + 1}\\b`) }).click()
      await page.waitForSelector('[role="grid"]')
      for (const t of ex.tasks) {
        if (t.kind !== 'explain') continue
        const card = cards().nth(ex.tasks.indexOf(t))
        await card.getByRole('button', { name: 'Show model answer' }).click()
        await card.getByRole('button', { name: 'Got it' }).click()
      }
    }
    await page.waitForTimeout(300)
    const [got2] = await total()
    expect(got2 === got + explainMarks, `self-marks did not lift the score: ${got2}`)
    await shot('mock-review-selfmarked')
  }
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem(`cs602-mock:${id}`) ?? 'null'), mock.id)
  expect(saved?.best?.got === got + explainMarks, `best not saved: ${JSON.stringify(saved?.best)}`)
  await page.getByRole('button', { name: 'Retake' }).click()
  await confirmDialog('Retake')
  await page.getByRole('button', { name: /Start the exam/ }).waitFor()
  await page.waitForTimeout(400)
  expect(/Best\s+\d/.test(await page.locator('main').innerText()), 'best score not on the intro')
})

await check('mock exam: auto-submits when the time runs out', async () => {
  await harness('view=list', 'h1')
  await page.evaluate(() => localStorage.removeItem('cs602-mock:fixture-mock-auto'))
  await harness('view=mock&minutes=0.05&mockId=fixture-mock-auto', 'h1')
  await page.getByRole('button', { name: /Start the exam/ }).click()
  await page.getByText('Time is up: submitted automatically').waitFor({ timeout: 20000 })
})

// ---------- phone ----------
await check('phone 390px: player, dialog, catalogue, sandbox and mock', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  if (formulaEx) {
    await harness(`id=${encodeURIComponent(formulaEx.id)}`)
    await shot('player-top')
    expect(await cards().nth(1).locator('p').first().isHidden(), 'inactive task cards are not collapsed on a phone')
    await cards().nth(1).locator('button').first().click()
    expect(await cards().nth(1).getByRole('button', { name: 'Go to the sheet' }).isVisible(), 'tapped task does not expand')
    await cards().nth(1).getByRole('button', { name: 'Go to the sheet' }).click()
    await page.waitForTimeout(700)
    const top = await page.locator('section[aria-label="Spreadsheet"]').evaluate(el => el.getBoundingClientRect().top)
    expect(Math.abs(top) < 40, `sheet not scrolled into view (top ${top})`)
    await shot('player-sheet')
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(over <= 1, `page scrolls sideways by ${over}px`)
  }
  if (goalEx) {
    await harness(`id=${encodeURIComponent(goalEx.id)}`)
    await page.locator('section[aria-label="Spreadsheet"]').scrollIntoViewIfNeeded()
    await toolbar().getByRole('button', { name: 'What-If Analysis' }).click()
    await page.getByRole('menuitem', { name: 'Goal Seek…' }).click()
    const dlg = dialog('Goal Seek')
    await dlg.waitFor()
    await page.waitForTimeout(350)   // scale-in animation
    const bb = await dlg.boundingBox()
    expect(bb && bb.width >= 385 && bb.height >= 800, `dialog not full-screen: ${JSON.stringify(bb)}`)
    await shot('goalseek-dialog')
    await page.keyboard.press('Escape')
    await dlg.waitFor({ state: 'detached' })
  }
  if (solverEx) {
    await harness(`id=${encodeURIComponent(solverEx.id)}`)
    await page.locator('section[aria-label="Spreadsheet"]').scrollIntoViewIfNeeded()
    await tool('Solver').click()
    await dialog('Solver Parameters').waitFor()
    await shot('solver-dialog')
    await page.keyboard.press('Escape')
  }
  await harness('view=catalogue', 'h1')
  await shot('catalogue')
  await app('/lab/sandbox', '[role="grid"]')
  await shot('sandbox')
  await harness('view=list', 'h1')
  await clearStorage()
  await harness('view=mock', 'h1')
  await shot('mock-intro')
  await page.getByRole('button', { name: /Start the exam/ }).click()
  await page.waitForSelector('[role="grid"]')
  await shot('mock-running')
  await page.setViewportSize({ width: 1280, height: 900 })
})

await check('no console errors', async () => {
  const real = errors.filter(e => !/fonts\.(googleapis|gstatic)/.test(e))
  expect(real.length === 0, real.slice(0, 5).join(' || '))
})

await browser.close()
await stopServer()

const pad = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length))
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.name, 96)} ${String(r.ms).padStart(6)} ms${r.ok ? '' : `\n      ${r.error}`}`)
for (const n of notes) console.log(`note: ${n}`)
const failed = results.filter(r => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} passed; screenshots in ${SHOTS}`)
process.exit(failed ? 1 : 0)
