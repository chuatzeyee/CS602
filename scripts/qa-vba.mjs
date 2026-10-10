// browser QA for the VBA editor: node scripts/qa-vba.mjs
// starts its own vite dev server on :4625 (hot reload off, own dependency cache) and stops it at the end.
// W9 exercises solved by putting macros into the editor, running and checking; a wrong macro; a run-time error; an
// InputBox Test macro; the sandbox; 390px. Screenshots: /tmp/cs602_vba. ONLY=<regex> runs a subset.
import { chromium } from 'playwright-core'
import { createServer, createLogger } from 'vite'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'

const PORT = 4625
const ORIGIN = `http://localhost:${PORT}`
const APP = `${ORIGIN}/CS602/#`
const SHOTS = '/tmp/cs602_vba'
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
if (await up()) {
  console.error(`port ${PORT} is already in use`)
  process.exit(2)
}
const LOG = `${SHOTS}/vite.log`
writeFileSync(LOG, '')
const logger = createLogger('info')
for (const level of ['info', 'warn', 'error']) logger[level] = msg => appendFileSync(LOG, `${level} ${msg}\n`)
const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  cacheDir: `${SHOTS}/.vite`,
  server: { port: PORT, strictPort: true, hmr: false },
  customLogger: logger,
})
await server.listen()
for (let i = 0; i < 40 && !(await up()); i++) await sleep(250)

const results = []
const notes = []
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg)
}
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('console', m => {
  if (m.type() === 'error') errors.push(`${page.url().replace(ORIGIN, '')} :: ${m.text()}`)
})
page.on('pageerror', e => errors.push(`${page.url().replace(ORIGIN, '')} :: ${e}`))
let promptAnswers = []
const prompts = []
page.on('dialog', async d => {
  prompts.push(`${d.type()}: ${d.message()}`)
  if (d.type() === 'prompt') await d.accept(promptAnswers.length ? promptAnswers.shift() : d.defaultValue())
  else await d.accept()
})

const width = () => page.viewportSize()?.width ?? 0
const shot = async name => page.screenshot({ path: `${SHOTS}/${name}-${width()}.png` })
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)
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

// ---------- helpers ----------
async function app(path, waitFor = '[role="grid"]') {
  await page.goto(`${APP}${path}`)
  await page.waitForSelector(waitFor, { timeout: 30000 })
  await page.waitForTimeout(250)
}
const toolbar = () => page.getByRole('toolbar', { name: 'Spreadsheet tools' })
const tool = label => toolbar().getByRole('button', { name: label, exact: true })
const cards = () => page.locator('aside[aria-label="Tasks"] article')
const nameBox = () => page.getByLabel('Name box', { exact: true })
const editor = () => page.getByLabel('VBA code', { exact: true })
const output = () => page.getByRole('region', { name: 'Output' })
const macroBox = () => page.getByLabel('Macro to run', { exact: true })
const runButton = () => page.getByRole('button', { name: /^Run/ })

async function select(ref) {
  await nameBox().click()
  await nameBox().fill(ref)
  await nameBox().press('Enter')
  await page.waitForTimeout(60)
}
async function cellText(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)
  const c = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
  return (await page.locator(`[role="grid"] [id$="-r${Number(m[2]) - 1}c${c}"]`).first().innerText()).trim()
}
async function setCode(text) {
  await editor().click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(text)
  await page.waitForTimeout(100)
}
async function runMacro(name) {
  if (name) await macroBox().selectOption(name)
  await runButton().click()
  await page.waitForFunction(() => !document.querySelector('button[title="Run the macro (F5)"] .animate-spin'), null, { timeout: 30000 })
  await page.waitForTimeout(200)
}
async function runCheck() {
  await tool('Check').click()
  await page.waitForFunction(
    () => ![...document.querySelectorAll('[role="toolbar"] button')].some(b => (b.textContent ?? '').includes('Checking')),
    null, { timeout: 60000 },
  )
  await page.waitForTimeout(200)
}
const statusOf = async i => {
  const card = cards().nth(i)
  for (const label of ['Correct', 'Not yet correct']) if (await card.locator(`[aria-label="${label}"]`).count()) return label
  return 'unchecked'
}
const messagesOf = async i => (await cards().nth(i).locator('ul li').allInnerTexts()).map(s => s.trim()).filter(Boolean)
async function openVbaFor(i) {
  await cards().nth(i).click()
  await page.waitForTimeout(150)
  const open = cards().nth(i).getByRole('button', { name: 'Open VBA editor' })
  if (await open.count()) await open.click()
  await editor().waitFor({ timeout: 10000 })
}

const w9 = await (async () => {
  await app('/lab', 'h1')
  return page.evaluate(async () => {
    const m = await import('/CS602/src/data/lab/w09.ts')
    return m.exercises.map(e => ({ id: e.id, title: e.title, tasks: e.tasks.map(t => ({ id: t.id, kind: t.kind, cells: t.cells, vba: t.vba, wrong: t.wrong, solution: t.solution, answer: t.answer })) }))
  })
})()
const exOf = id => w9.find(e => e.id === id)

// open a page with no saved progress: leave the player first (it saves on the way out), then clear storage
async function fresh(path) {
  await app('/lab', 'h1')
  await page.waitForTimeout(300)
  await page.evaluate(() => localStorage.clear())
  await app(path)
}
const timed = async (label, fn) => {
  const t0 = Date.now()
  const r = await fn()
  if (Date.now() - t0 > 3000) notes.push(`${label} took ${Date.now() - t0} ms`)
  return r
}

// solve one exercise's vba task by putting its solution into the editor, running the entry and checking
async function solveVba(id, taskId) {
  const ex = exOf(id)
  expect(ex, `no exercise ${id}`)
  await fresh(`/lab/${id}`)
  const i = ex.tasks.findIndex(t => t.id === taskId)
  const t = ex.tasks[i]
  await openVbaFor(i)
  const start = await editor().inputValue()
  expect(start.trim() === t.vba.starter.trim(), `${id}: the editor does not start with the starter`)
  await setCode(t.vba.solution)
  expect((await editor().inputValue()).trim() === t.vba.solution.trim(), `${id}: the code did not go in as typed`)
  return { ex, t, i }
}

// ---------- scenarios ----------
await check('bibs: type the macro, run TestBibs, the grid fills, Check ticks the task', async () => {
  const { t, i } = await solveVba('w9-vba-for-next-bibs', 'number-bibs')
  const how = await cards().nth(i).innerText()
  expect(how.includes(`Complete the macro in the VBA editor, run ${t.vba.entry} to test it, then Check.`), `task card text: ${how}`)
  await cards().nth(i).screenshot({ path: `${SHOTS}/bibs-card.png` })
  expect(await macroBox().inputValue() === t.vba.entry, `macro box shows ${await macroBox().inputValue()}, not ${t.vba.entry}`)
  await runMacro(t.vba.entry)
  const out = await output().innerText()
  expect(out.includes(`Ran ${t.vba.entry}`), `output: ${out}`)
  const [ref, want] = Object.entries(t.vba.expected).find(([, v]) => v !== null)
  const got = await cellText(ref)
  expect(got.toLowerCase() === String(want).toLowerCase() || Number(got) === want, `${ref} shows ${got}, expected ${want}`)
  await shot('bibs-ran')
  await runCheck()
  expect(await statusOf(i) === 'Correct', `status ${await statusOf(i)}: ${(await messagesOf(i)).join(' | ')}`)
  await shot('bibs-checked')
})

await check('function task: TablesNeeded typed in, Check calls it', async () => {
  const { i } = await solveVba('w9-vba-function-tables', 'tables-needed')
  expect(await macroBox().isDisabled(), 'a module with only a Function should have no runnable macro')
  await runCheck()
  expect(await statusOf(i) === 'Correct', `status ${await statusOf(i)}: ${(await messagesOf(i)).join(' | ')}`)
})

await check('post deliveries: run TestTwoDays, ledger fills, Check ticks; formulas then count the posted rows', async () => {
  const { ex, t, i } = await solveVba('w9-vba-post-deliveries', 'post')
  await runMacro(t.vba.entry)
  const out = await output().innerText()
  expect(out.includes(`Ran ${t.vba.entry}`), `output: ${out}`)
  expect(await cellText('B25') === 'DairyLand', `B25 shows ${await cellText('B25')}`)
  expect(await page.getByRole('button', { name: 'Undo the run' }).count() === 1, 'no Undo the run')
  await runCheck()
  expect(await statusOf(i) === 'Correct', `status ${await statusOf(i)}: ${(await messagesOf(i)).join(' | ')}`)
  await shot('post-checked')
  // a stronger wrong formula fails because the macro's rows are part of the model
  const k = ex.tasks.findIndex(x => x.id === 'short-count')
  await cards().nth(k).click()
  await select('J8')
  await page.keyboard.type('=COUNTIF(G16:G24,"Short")', { delay: 2 })
  await page.keyboard.press('Enter')
  await runCheck()
  expect(await statusOf(k) === 'Not yet correct', `short-count accepted G16:G24 (${await statusOf(k)})`)
})

await check('line numbers scroll with the code; Undo the run and Reset to the starter work', async () => {
  const { t } = await solveVba('w9-vba-post-deliveries', 'post')
  const shift = await editor().evaluate(el => {
    el.scrollTop = 200
    el.dispatchEvent(new Event('scroll'))
    return el.scrollTop
  })
  await page.waitForTimeout(100)
  const transforms = await page.evaluate(() => [...document.querySelectorAll('[aria-hidden="true"] > div[style*="translate"]')].map(d => d.getAttribute('style')))
  expect(shift > 0 && transforms.length >= 2 && transforms.every(s => s.includes(`-${shift}px`)), `gutter/colours not synced: ${shift} ${JSON.stringify(transforms)}`)
  await runMacro(t.vba.entry)
  expect(await cellText('B25') === 'DairyLand', 'macro did not post')
  await page.getByRole('button', { name: 'Undo the run' }).click()
  await page.waitForTimeout(200)
  expect(await cellText('B25') === '', `B25 after undo: ${await cellText('B25')}`)
  expect(await cellText('B5') === 'Leaf & Co', `B5 after undo: ${await cellText('B5')}`)
  await page.getByRole('button', { name: 'Reset the code to the starter', exact: true }).click()
  const dlg = page.getByRole('alertdialog')
  await dlg.waitFor()
  await dlg.getByRole('button', { name: 'Reset', exact: true }).click()
  await dlg.waitFor({ state: 'detached' })
  expect((await editor().inputValue()).trim() === t.vba.starter.trim(), 'Reset did not restore the starter')
})

await check('a wrong macro gets a specific message and no solution text', async () => {
  const { t, i } = await solveVba('w9-vba-post-deliveries', 'post')
  await setCode(t.vba.solution.replace('Range("B5:F12").ClearContents', "' forgot to clear"))
  await runCheck()
  expect(await statusOf(i) === 'Not yet correct', 'wrong macro passed')
  const msgs = await messagesOf(i)
  expect(msgs.some(m => /should be empty after the run/.test(m)), `messages: ${msgs.join(' | ')}`)
  expect(!msgs.some(m => m.includes('ClearContents')), 'message reveals the solution')
  await shot('post-wrong')
})

await check('a run-time error is shown with its line highlighted', async () => {
  const { t } = await solveVba('w9-vba-for-next-bibs', 'number-bibs')
  const broken = t.vba.solution.replace(/(Sub \w+\(\)\n)(?![\s\S]*Sub TestBibs)/, '$1    Dim n As Integer\n    n = 200 * 200\n')
  await setCode(broken)
  const line = broken.split('\n').findIndex(l => l.includes('200 * 200')) + 1
  expect(line > 0, 'could not plant the error')
  await runMacro(t.vba.entry)
  const out = await output().innerText()
  expect(/Run-time error '6': Overflow/.test(out), `output: ${out}`)
  expect(out.includes(`Line ${line}`), `output does not name line ${line}: ${out}`)
  const gutter = page.locator('.text-wrong.font-semibold', { hasText: new RegExp(`^${line}$`) })
  expect(await gutter.count() === 1, 'error line number not highlighted')
  await page.getByRole('button', { name: 'Go to line' }).click()
  const caret = await editor().evaluate(el => el.value.slice(0, el.selectionStart).split('\n').length)
  expect(caret === line, `Go to line put the caret on line ${caret}`)
  await shot('runtime-error')
})

await check('InputBox Test macro uses the scripted answers; other macros ask with a prompt', async () => {
  const { t, i } = await solveVba('w9-vba-inputbox-errors', 'set-dose')
  await runMacro(t.vba.entry)
  const out = await output().innerText()
  expect(/InputBox/i.test(out), `no InputBox lines: ${out}`)
  expect(out.includes(t.vba.inputs[0]), `scripted answer ${t.vba.inputs[0]} not shown: ${out}`)
  await runCheck()
  expect(await statusOf(i) === 'Correct', `status ${await statusOf(i)}: ${(await messagesOf(i)).join(' | ')}`)
  await shot('inputbox-test')
  prompts.length = 0
  promptAnswers.push('3.5')
  await setCode('Sub AskOnce()\n    Range("D2").Value = InputBox("Dose for D2?")\nEnd Sub\n')
  await runMacro('AskOnce')
  expect(prompts.some(p => p.includes('Dose for D2?')), `no prompt: ${prompts.join(' | ')}`)
  expect(await cellText('D2') === '3.5', `D2 shows ${await cellText('D2')}`)
})

await check('editor keys: Tab indents, Enter keeps indentation, Shift+Tab outdents, F5 runs', async () => {
  await timed('open sandbox', () => fresh('/lab/sandbox'))
  await timed('open editor', async () => {
    await tool('VBA').click()
    await editor().waitFor()
  })
  await timed('clear code', () => setCode(''))
  await page.keyboard.type('Sub Typed()')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.type('Range("B2").Value = 6 * 7')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Debug.Print "answer"; Range("B2").Value')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.type('End Sub')
  const code = await editor().inputValue()
  expect(code === 'Sub Typed()\n    Range("B2").Value = 6 * 7\n    Debug.Print "answer"; Range("B2").Value\nEnd Sub', `typed code: ${JSON.stringify(code)}`)
  await timed('F5', async () => {
    await page.keyboard.press('F5')
    await page.waitForTimeout(400)
  })
  expect(page.url().includes('/lab/sandbox'), 'F5 left the page')
  const out = await output().innerText()
  expect(out.includes('answer 42'), `output: ${out}`)
  expect(await cellText('B2') === '42', `B2 shows ${await cellText('B2')}`)
  await shot('sandbox-typed')
})

await check('sandbox: Hello macro, MsgBox output, selection follows the macro', async () => {
  await setCode('Sub Hello()\n    Range("A1").Value = "Hello from VBA"\n    Range("A1").Font.Bold = True\n    Range("A1").Interior.Color = vbYellow\n    Range("C5:D6").Select\n    MsgBox "Done"\nEnd Sub\n')
  await runMacro('Hello')
  expect(await cellText('A1') === 'Hello from VBA', `A1 shows ${await cellText('A1')}`)
  expect(/msgbox\s*done/i.test(await output().innerText()), `no MsgBox line: ${await output().innerText()}`)
  expect(['C5', 'C5:D6'].includes(await nameBox().inputValue()), `name box shows ${await nameBox().inputValue()}`)
  expect(/Formatting set by the run[\s\S]*A1: bold, fill/.test(await output().innerText()), `no format summary: ${await output().innerText()}`)
  await shot('sandbox-hello')
})

await check('390px: the VBA panel fits a phone', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await solveVba('w9-vba-post-deliveries', 'post')
  await editor().scrollIntoViewIfNeeded()
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(over <= 0, `page scrolls sideways by ${over}px`)
  const size = await editor().evaluate(el => parseFloat(getComputedStyle(el).fontSize))
  expect(size >= 16, `editor font ${size}px makes iOS zoom`)
  await runMacro('TestTwoDays')
  await output().scrollIntoViewIfNeeded()
  await shot('phone-post')
  await page.setViewportSize({ width: 1280, height: 900 })
})

await check('no console errors', async () => {
  expect(errors.length === 0, errors.slice(0, 5).join(' || '))
})

await browser.close()
await server.close()
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name} (${r.ms} ms)${r.ok ? '' : `\n      ${r.error}`}`)
for (const n of notes) console.log(`note: ${n}`)
console.log(`${results.filter(r => r.ok).length}/${results.length} passed; screenshots in ${SHOTS}`)
process.exit(results.every(r => r.ok) ? 0 : 1)
