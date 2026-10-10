// browser QA for the decision-tool dialogs (Advanced Filter, Sort, Filter, PivotTable) in the real Player:
// node scripts/qa-tools.mjs   (uses vite on :4623, starting it when nothing answers; PORT=... to reuse another)
// screenshots: /tmp/cs602_tools
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = process.env.PORT ?? '4623'
const ORIGIN = `http://localhost:${PORT}`
const HARNESS = `${ORIGIN}/CS602/dev/tools-harness.html`
const SHOTS = process.env.SHOTS ?? '/tmp/cs602_tools'
mkdirSync(SHOTS, { recursive: true })

const sleep = ms => new Promise(r => setTimeout(r, ms))
const up = async () => {
  try {
    return (await fetch(`${ORIGIN}/CS602/`)).ok
  } catch {
    return false
  }
}
let server = null
if (!(await up())) {
  server = spawn('npx', ['vite', '--port', PORT, '--strictPort'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore', detached: true })
  for (let i = 0; i < 120 && !(await up()); i++) await sleep(250)
}

const results = []
const expect = (cond, msg) => { if (!cond) throw new Error(msg) }
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(`console: ${m.text()}`) })
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`) })

const width = () => page.viewportSize()?.width ?? 0
const shot = async name => page.screenshot({ path: `${SHOTS}/${name}-${width()}.png` })
async function check(name, fn) {
  const t0 = Date.now()
  try {
    await fn()
    results.push({ ok: true, name, ms: Date.now() - t0 })
  } catch (e) {
    results.push({ ok: false, name, ms: Date.now() - t0, error: String(e.message ?? e).split('\n')[0] })
    await shot(`FAIL-${name.replace(/[^a-z0-9]+/gi, '-')}`).catch(() => undefined)
  }
}

const nameBox = () => page.getByLabel('Name box', { exact: true })
const toolbar = () => page.getByRole('toolbar', { name: 'Spreadsheet tools' })
const tool = label => toolbar().getByRole('button', { name: label, exact: true })
const dialog = title => page.getByRole('dialog', { name: title, exact: true })
const status = () => page.locator('[role="status"][aria-live="polite"]').first()
const colNum = s => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

async function load() {
  await page.goto(HARNESS)
  await page.waitForSelector('[role="grid"]', { timeout: 30000 })
  await page.waitForTimeout(300)
}
async function select(ref) {
  await nameBox().click()
  await nameBox().fill(ref)
  await nameBox().press('Enter')
  await page.waitForTimeout(60)
}
async function enter(ref, text) {
  await select(ref)
  if (text === '') await page.keyboard.press('Delete')
  else {
    await page.keyboard.type(text, { delay: 3 })
    await page.keyboard.press('Enter')
  }
  await page.waitForTimeout(80)
}
async function cellText(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)
  await select(ref)
  return (await page.locator(`[role="grid"] [id$="-r${Number(m[2]) - 1}c${colNum(m[1])}"]`).first().innerText()).trim()
}
const statusText = async () => (await status().innerText()).trim()

await load()

await check('advanced filter in place: 8 of 60, then Clear filter', async () => {
  await select('C20')
  await tool('Advanced').click()
  const dlg = dialog('Advanced Filter')
  await dlg.waitFor()
  expect(await dlg.getByLabel('List range:', { exact: true }).inputValue() === 'A8:K68', 'list range prefilled from the criteria task')
  expect(await dlg.getByLabel('Criteria range:', { exact: true }).inputValue() === 'A1:B2', 'criteria prefilled from the criteria task')
  expect(await dlg.getByLabel('Copy to:', { exact: true }).isDisabled(), 'Copy to disabled in place')
  await shot('advfilter-dialog')
  await dlg.getByRole('button', { name: 'OK', exact: true }).click()
  await dlg.waitFor({ state: 'detached' })
  const s = await statusText()
  expect(s.includes('8 of 60 records found'), `status: ${s}`)
  await shot('advfilter-in-place')
  await tool('Advanced').click()
  await dialog('Advanced Filter').getByRole('button', { name: 'Clear filter' }).click()
  expect((await statusText()).includes('Filter cleared'), 'cleared')
})

await check('advanced filter: =North typed as a formula gets a learner note', async () => {
  await enter('A1', 'Region')
  await enter('B1', '')
  await enter('A2', '=North')
  await enter('B2', '')
  await tool('Advanced').click()
  const dlg = dialog('Advanced Filter')
  await dlg.getByLabel('Criteria range:', { exact: true }).fill('A1:A2')
  await dlg.getByRole('button', { name: 'OK', exact: true }).click()
  await dlg.getByText('Check your criteria range:').waitFor()
  const text = await dlg.innerText()
  expect(text.includes('0 of 60 records found'), text)
  expect(text.includes('="=North"'), text)
  await shot('advfilter-notes')
  await dlg.getByRole('button', { name: 'OK', exact: true }).click()
  await tool('Advanced').click()
  await dialog('Advanced Filter').getByRole('button', { name: 'Clear filter' }).click()
})

await check('advanced filter: copy to N8 with unique records', async () => {
  await enter('A1', 'Blend')
  await enter('A2', 'Single Origin')
  await enter('N8', 'Customer')
  await tool('Advanced').click()
  const dlg = dialog('Advanced Filter')
  await dlg.getByLabel('Copy to another location').check()
  await dlg.getByLabel('Copy to:', { exact: true }).fill('N8')
  await dlg.getByLabel('Unique records only').check()
  await dlg.getByRole('button', { name: 'OK', exact: true }).click()
  await dlg.waitFor({ state: 'detached' })
  expect((await statusText()).includes('10 of 60 records copied to N8'), await statusText())
  expect(await cellText('N9') === 'Hougang Heartland Hotel', await cellText('N9'))
  expect(await cellText('N18') === 'Tiong Bahru Bakehouse', await cellText('N18'))
  expect(await cellText('N19') === '', 'N19 empty')
  await shot('advfilter-copy-unique')
})

await check('sort: Revenue largest to smallest, then a custom list', async () => {
  await select('C20')
  await tool('Sort').click()
  const dlg = dialog('Sort')
  await dlg.waitFor()
  await dlg.getByLabel('Sort by column').selectOption('Revenue')
  await dlg.getByLabel('Order').selectOption('desc')
  expect((await dlg.getByLabel('Order').innerText()).includes('Largest to Smallest'), 'number wording')
  await shot('sort-dialog')
  await dlg.getByRole('button', { name: 'OK', exact: true }).click()
  await dlg.waitFor({ state: 'detached' })
  expect(await cellText('A9') === 'HC-1002', await cellText('A9'))
  await tool('Sort').click()
  const d2 = dialog('Sort')
  await d2.getByLabel('Sort by column').selectOption('Status')
  await d2.getByLabel('Order').selectOption('custom')
  await d2.getByLabel('Custom list entries').fill('Overdue, Pending, Paid')
  await d2.getByRole('button', { name: 'Add Level' }).click()
  await d2.getByLabel('Then by column').selectOption('OrderDate')
  expect((await d2.getByLabel('Order').nth(1).innerText()).includes('Oldest to Newest'), 'date wording')
  await shot('sort-custom-list')
  await d2.getByRole('button', { name: 'OK', exact: true }).click()
  await d2.waitFor({ state: 'detached' })
  expect(await cellText('K9') === 'Overdue' && await cellText('A9') === 'HC-1020', `${await cellText('K9')} ${await cellText('A9')}`)
  expect(await cellText('K17') === 'Pending', await cellText('K17'))
})

await check('autofilter: Top 5 keeps the tie (6 rows), AND with a checklist, Clear All', async () => {
  await select('C20')
  await tool('Filter').click()
  const dlg = dialog('Filter (AutoFilter)')
  await dlg.waitFor()
  await dlg.getByLabel('Column:', { exact: true }).selectOption('Revenue')
  await dlg.getByLabel('Filter:', { exact: true }).selectOption('top10')
  await dlg.getByLabel('How many').fill('5')
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click()
  await dlg.getByText('6 of 60 records found').waitFor()
  await shot('autofilter-top5')
  await dlg.getByLabel('Column:', { exact: true }).selectOption('Region')
  await dlg.getByLabel('(Select All)').uncheck()
  await dlg.getByLabel('West', { exact: true }).check()
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click()
  await dlg.getByText('1 of 60 records found').waitFor()
  await dlg.getByLabel('Column:', { exact: true }).selectOption('Customer')
  await dlg.getByLabel('Filter:', { exact: true }).selectOption('contains')
  await shot('autofilter-and-checklist')
  await dlg.getByRole('button', { name: 'Clear All' }).click()
  await dlg.getByText('All filters cleared').waitFor()
  await dlg.getByLabel('Column:', { exact: true }).selectOption('Customer')
  await dlg.getByLabel('Filter:', { exact: true }).selectOption('contains')
  await dlg.getByLabel('First value').fill('Hotel')
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click()
  await dlg.getByText('11 of 60 records found').waitFor()
  await shot('autofilter-contains')
  await dlg.getByRole('button', { name: 'Clear All' }).click()
  await dlg.getByRole('button', { name: 'Close', exact: true }).first().click()
})

await check('pivot: tick Region + Revenue, create at M3, then add Channel to Columns', async () => {
  await select('C20')
  await tool('PivotTable').click()
  const dlg = dialog('PivotTable')
  await dlg.waitFor()
  expect(await dlg.getByLabel('Table/Range:', { exact: true }).inputValue() === '$A$8:$K$68', 'source = current region')
  await dlg.getByLabel('Location (existing worksheet):', { exact: true }).fill('M3')
  await dlg.getByRole('checkbox', { name: 'Region', exact: true }).check()
  await dlg.getByRole('checkbox', { name: 'Revenue', exact: true }).check()
  await shot('pivot-dialog')
  await dlg.getByRole('button', { name: 'Create', exact: true }).click()
  // N9 still holds the Copy to extract from the Advanced Filter check: Excel asks before replacing it
  await dlg.getByText("There's already data in M3:N9. Do you want to replace it?").waitFor()
  await shot('pivot-replace-prompt')
  await dlg.getByRole('button', { name: 'Replace', exact: true }).click()
  await dlg.getByText('PivotTable created at M3.').waitFor()
  await shot('pivot-created')
  await dlg.getByRole('button', { name: 'Close', exact: true }).first().click()
  expect(await cellText('M3') === 'Row Labels', await cellText('M3'))
  expect(await cellText('N3') === 'Sum of Revenue', await cellText('N3'))
  expect(await cellText('M9') === 'Grand Total', await cellText('M9'))
  expect((await cellText('N9')).replace(/,/g, '') === '36341.2', await cellText('N9'))
  await shot('pivot-created-grid')
  await select('C20')
  await tool('PivotTable').click()
  await dlg.waitFor()
  expect(await dlg.getByRole('checkbox', { name: 'Region', exact: true }).isChecked(), 'layout remembered')
  await dlg.getByLabel('Add a field to Columns').selectOption('Channel')
  await dlg.getByRole('button', { name: 'Create', exact: true }).click()
  await dlg.getByText("There's already data in M3:R10. Do you want to replace it?").waitFor()
  await dlg.getByRole('button', { name: 'Replace', exact: true }).click()
  await dlg.getByText('PivotTable created at M3.').waitFor()
  await dlg.getByRole('button', { name: 'Close', exact: true }).first().click()
  expect(await cellText('N3') === 'Column Labels', await cellText('N3'))
  expect(await cellText('R4') === 'Grand Total', await cellText('R4'))
  expect(await cellText('M10') === 'Grand Total', await cellText('M10'))
  await shot('pivot-two-way')
})

await check('keyboard: Tab stays inside the dialog, Esc closes it', async () => {
  await tool('Sort').click()
  const dlg = dialog('Sort')
  await dlg.waitFor()
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
    expect(inside, `focus left the dialog after ${i + 1} Tab presses`)
  }
  await page.keyboard.press('Escape')
  await dlg.waitFor({ state: 'detached' })
})

await check('mobile: dialogs are full-screen', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)
  for (const [button, title] of [['Advanced', 'Advanced Filter'], ['Filter', 'Filter (AutoFilter)'], ['Sort', 'Sort'], ['PivotTable', 'PivotTable']]) {
    await tool(button).click()
    const dlg = dialog(title)
    await dlg.waitFor()
    await page.waitForTimeout(350)   // let the scale-in animation finish
    const b = await dlg.boundingBox({ timeout: 3000 }).catch(() => { throw new Error(`${title} closed by itself (${errors.join('; ')})`) })
    expect(b && b.width >= 385 && b.height >= 800, `${title} is ${b?.width}x${b?.height}`)
    await shot(`mobile-${button.toLowerCase()}`)
    await page.keyboard.press('Escape')
    await dlg.waitFor({ state: 'detached' })
  }
  await page.setViewportSize({ width: 1280, height: 900 })
})

await check('Week 10 exercises: catalogue lists 7, a criteria task checks through the real player', async () => {
  await page.goto(`${ORIGIN}/CS602/#/lab?week=W10`)
  await page.getByText('Criteria ranges: same row AND, new row OR').first().waitFor({ timeout: 30000 })
  await shot('lab-w10-catalogue')
  await page.goto(`${ORIGIN}/CS602/#/lab/w10-advfilter-and-or`)
  await page.waitForSelector('[role="grid"]', { timeout: 30000 })
  await enter('A2', '="=Hotel"')
  await enter('B2', '>=20')
  await enter('D2', 'North')
  await enter('D3', '="=West"')
  await tool('Check').click()
  await page.waitForFunction(() => ![...document.querySelectorAll('[role="toolbar"] button')].some(b => (b.textContent ?? '').includes('Checking')), null, { timeout: 60000 })
  const cards = page.locator('aside[aria-label="Tasks"] article')
  await cards.nth(0).getByText('Why it works').waitFor()
  expect((await cards.nth(1).innerText()).includes('33 rows'), 'begins-with trap explained on task 2')
  await shot('lab-w10-checked')
})

await browser.close()
if (server) try { process.kill(-server.pid) } catch { /* gone */ }
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name} (${r.ms} ms)${r.ok ? '' : `: ${r.error}`}`)
if (errors.length) console.log(`browser errors:\n  ${[...new Set(errors)].join('\n  ')}`)
console.log(`${results.filter(r => r.ok).length}/${results.length} passed; screenshots in ${SHOTS}`)
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1)
