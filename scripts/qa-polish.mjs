// polish pass browser check: screenshots of the main pages at 1280 and 390 px, plus checks for the grid's sticky
// headers, mono ligatures, the data dialogs' start range, the bottom nav pill and the home cards.
// usage: npx vite --port 4630 --strictPort, then node scripts/qa-polish.mjs [port]   (screenshots: /tmp/cs602_polish)
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const PORT = process.argv[2] ?? '4630'
const ROOT = `http://localhost:${PORT}/CS602`
const OUT = '/tmp/cs602_polish'
mkdirSync(OUT, { recursive: true })

const results = []
const record = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail })
const problems = []

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })

async function open(width, height, { mobile = false, scale = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile })
  const page = await ctx.newPage()
  const label = `${width}px`
  page.on('pageerror', e => problems.push(`${label} pageerror: ${String(e).slice(0, 240)}`))
  page.on('console', m => { if (m.type() === 'error') problems.push(`${label} console: ${m.text().slice(0, 240)}`) })
  return page
}

const rectOf = (page, selector) => page.evaluate(s => {
  const e = document.querySelector(s)
  if (!e) return null
  const r = e.getBoundingClientRect()
  return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
}, selector)
const PILL = 'nav.fixed > div'
const SHEET = 'section[aria-label=Spreadsheet]'

async function nameBox(page, ref) {
  const box = page.getByRole('textbox', { name: 'Name box' })
  await box.click()
  await box.fill(ref)
  await box.press('Enter')
  await page.waitForTimeout(150)
}

// ---------- pages at both widths ----------
const PAGES = [['home', '/#/'], ['lab', '/#/lab'], ['sandbox', '/#/lab/sandbox'], ['exam', '/#/exam'], ['project', '/#/project']]
for (const [w, h, mobile] of [[1280, 900, false], [390, 844, true]]) {
  const page = await open(w, h, { mobile })
  for (const [name, path] of PAGES) {
    await page.goto(ROOT + path)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(name === 'home' ? 900 : 500)
    await page.screenshot({ path: `${OUT}/${name}-${w}.png` })
    if (name === 'home' || name === 'lab') await page.screenshot({ path: `${OUT}/${name}-${w}-full.png`, fullPage: true })
    if (name === 'exam' || name === 'project') {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${OUT}/${name}-${w}-end.png` })
    }
  }
  await page.context().close()
}

// ---------- nav pill: one-line labels wherever they show (a left-1/2 fixed box shrinks to half the viewport) ----------
for (const w of [1280, 1440]) {
  const page = await open(w, 900)
  await page.goto(`${ROOT}/#/lab`)
  await page.waitForLoadState('networkidle')
  const tall = await page.evaluate(() => [...document.querySelectorAll('nav.fixed a span')]
    .filter(e => e.getBoundingClientRect().height > 20).map(e => e.textContent))
  record(`nav ${w}: labels on one line`, tall.length === 0, tall.join(', '))
  if (w === 1280) await page.locator(PILL).screenshot({ path: `${OUT}/navpill-1280.png` })
  await page.context().close()
}

// ---------- home: the new cards and their counts, no lab runtime on the home page ----------
{
  const page = await open(1280, 900)
  const urls = []
  page.on('request', r => urls.push(r.url()))
  await page.goto(`${ROOT}/#/`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
  const cards = await page.locator('main a.group h2').allTextContents()
  record('home: 8 cards incl. Excel Lab, Exam Prep, Group Project', cards.length === 8 && ['Excel Lab', 'Exam Prep', 'Group Project'].every(t => cards.includes(t)), cards.join(', '))
  const badges = await page.locator('main a.group span.rounded-full').allTextContents()
  const has = re => badges.some(b => re.test(b))
  record('home: lab counts (exercises, tasks)', has(/^\d+ exercises?$/) && has(/^\d+ tasks?$/), badges.join(' | '))
  record('home: exam and project counts', has(/^\d+ exam techniques?$/) && has(/^\d+ deliverables?$/) && has(/^\d+ drill questions?$/))
  const runtime = urls.filter(u => /\/src\/lab\/|hyperformula|javascript-lp-solver/.test(u))
  record('home: no lab engine/sheet/checker/components requested', runtime.length === 0, runtime.slice(0, 3).join(' '))
  await page.context().close()
}

// ---------- 1. grid: sticky headers stay opaque (selected rows, hover, whole row) ----------
{
  const page = await open(390, 844, { mobile: false, scale: 2 })
  await page.goto(`${ROOT}/dev/player-harness.html?id=fx-datatables`)
  await page.waitForSelector('[role=grid]')
  await nameBox(page, 'G2:J5')
  const alphas = async () => page.evaluate(() => [...document.querySelectorAll('[role=rowheader],[role=columnheader]')].map(h => {
    const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(h).backgroundColor)
    const parts = m ? m[1].split(',').map(Number) : [0, 0, 0, 0]
    return parts.length === 4 ? parts[3] : 1
  }))
  await page.evaluate(() => { document.querySelector('[role=grid]').scrollLeft = 530 })
  await page.waitForTimeout(150)
  const sel = await alphas()
  await page.screenshot({ path: `${OUT}/grid-headers-selected.png`, clip: { x: 0, y: 0, width: 390, height: 520 } })
  await page.locator('[role=rowheader]').nth(3).hover()
  await page.waitForTimeout(150)
  const hover = await alphas()
  await page.locator('[role=rowheader]').nth(1).click()
  await page.evaluate(() => { document.querySelector('[role=grid]').scrollLeft = 40 })
  await page.waitForTimeout(150)
  const row = await alphas()
  await page.screenshot({ path: `${OUT}/grid-headers-wholerow.png`, clip: { x: 0, y: 0, width: 390, height: 520 } })
  record('grid: row/column headers opaque (selected, hover, whole row)', [...sel, ...hover, ...row].every(a => a === 1), `${sel.length} headers`)
  await page.context().close()
}

// ---------- 2. ligatures off wherever the mono font is used ----------
{
  const page = await open(1280, 900, { scale: 2 })
  await page.goto(`${ROOT}/#/lab/sandbox`)
  await page.waitForSelector('[role=grid]')
  await page.evaluate(() => document.fonts.ready)
  const font = await page.evaluate(() => document.fonts.check('12px "JetBrains Mono"'))
  await nameBox(page, 'B2')
  await page.keyboard.type('=IF(A1>=B1,"<>","<=")')
  await page.keyboard.press('Enter')
  await nameBox(page, 'B2')
  const style = await page.evaluate(() => {
    const bar = document.querySelector('input[aria-label="Formula bar"]')
    const grid = document.querySelector('[role=grid]')
    const s = e => { const c = getComputedStyle(e); return `${c.fontVariantLigatures} / ${c.fontFeatureSettings}` }
    return { bar: s(bar), grid: s(grid) }
  })
  record('mono: ligatures off on formula bar and grid', [style.bar, style.grid].every(s => s.startsWith('none') && s.includes('"liga" 0') && s.includes('"calt" 0')), `${JSON.stringify(style)}; JetBrains Mono loaded: ${font}`)
  const bar = page.locator('input[aria-label="Formula bar"]')
  const after = await bar.screenshot({ path: `${OUT}/ligatures-off-bar.png` })
  await page.getByRole('button', { name: /Show formulas|=f/ }).first().click()
  await page.waitForTimeout(150)
  await page.locator('[role=grid]').screenshot({ path: `${OUT}/ligatures-off-grid.png` })
  // the same text with ligatures forced back on: proves the font draws them, so the rule matters
  await page.addStyleTag({ content: '.font-mono, input { font-variant-ligatures: normal !important; font-feature-settings: normal !important }' })
  await page.waitForTimeout(150)
  const before = await bar.screenshot({ path: `${OUT}/ligatures-on-bar.png` })
  record('mono: the rule changes rendering (font has ligatures)', !after.equals(before), font ? '' : 'JetBrains Mono did not load (fallback font)')
  await page.context().close()
}

// ---------- 3. data dialogs: start from the current region, errors only on Create/OK ----------
async function dialogState(page) {
  const d = page.locator('[role=dialog]').first()
  await d.waitFor()
  await page.waitForTimeout(250)
  const fields = await d.locator('input[data-ref-field]').evaluateAll(els => els.map(e => e.value))
  const red = (await d.locator('.text-wrong').allTextContents()).filter(Boolean)
  return { d, fields, red }
}
async function openTool(page, id, tool, ref) {
  await page.goto(`${ROOT}/#/lab/${id}`)
  await page.waitForSelector('[role=grid]')
  if (ref) await nameBox(page, ref)
  await page.getByRole('toolbar', { name: 'Spreadsheet tools' }).getByRole('button', { name: tool, exact: true }).click()
  return dialogState(page)
}
for (const [w, h, mobile] of [[1280, 900, false], [390, 844, true]]) {
  const page = await open(w, h, { mobile })
  let s = await openTool(page, 'w10-pivot-orders', 'PivotTable')
  await s.d.screenshot({ path: `${OUT}/pivot-a1-${w}.png` })
  record(`pivot ${w}: blank A1 opens with an empty Table/Range and no error`, s.fields[0] === '' && s.red.length === 0, `${JSON.stringify(s.fields)} ${JSON.stringify(s.red)}`)
  await s.d.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForTimeout(200)
  const red = await s.d.locator('.text-wrong').allTextContents()
  record(`pivot ${w}: Create shows the source error`, red.some(t => /cell reference|table or range|header row/i.test(t)), red.join(' | '))
  await page.keyboard.press('Escape')
  s = await openTool(page, 'w10-pivot-orders', 'PivotTable', 'C20')
  record(`pivot ${w}: a cell in the list opens with its current region`, s.fields[0] === '$A$8:$K$68' && s.red.length === 0, JSON.stringify(s.fields))
  await s.d.getByRole('checkbox', { name: 'Region' }).check()
  await s.d.getByRole('checkbox', { name: 'Revenue' }).check()
  await s.d.screenshot({ path: `${OUT}/pivot-fields-${w}.png` })
  await s.d.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForTimeout(400)
  const created = await s.d.locator('[role=status]').allTextContents()
  record(`pivot ${w}: Create writes the PivotTable`, created.some(t => /created at M3/.test(t)), created.join(' '))
  await page.screenshot({ path: `${OUT}/pivot-created-${w}.png` })
  if (w === 1280) {
    // opened on a blank cell, then a cell of the list picked into the range box: one cell stands for its region
    for (const [id, tool, probe] of [
      ['w10-pivot-orders', 'PivotTable', d => d.getByRole('checkbox', { name: 'Region' }).count()],
      ['w10-sort-custom-list', 'Sort', d => d.getByRole('combobox', { name: 'Sort by column' }).locator('option', { hasText: 'Region' }).count()],
      ['w10-autofilter-number-filters', 'Filter', d => d.locator('select option', { hasText: 'Region' }).count()],
    ]) {
      s = await openTool(page, id, tool)
      await s.d.locator('input[data-ref-field]').first().focus()
      await nameBox(page, 'C20')
      await s.d.getByRole('button', { name: /^Use the grid selection C20/ }).first().click()
      await page.waitForTimeout(200)
      const value = await s.d.locator('input[data-ref-field]').first().inputValue()
      record(`${tool} 1280: picking one list cell lists the region's fields`, (await probe(s.d)) > 0, value)
      await page.keyboard.press('Escape')
    }
    // no criteria task in the sandbox: Advanced Filter starts from the (blank) selection like the others
    s = await openTool(page, 'sandbox', 'Advanced')
    record('Advanced 1280: blank sandbox cell opens with an empty list range, no errors', s.fields[0] === '' && s.red.length === 0, JSON.stringify(s.fields))
    await page.keyboard.press('Escape')
    for (const [id, tool] of [['w10-sort-custom-list', 'Sort'], ['w10-autofilter-number-filters', 'Filter'], ['w10-advfilter-and-or', 'Advanced']]) {
      s = await openTool(page, id, tool)
      await s.d.screenshot({ path: `${OUT}/dialog-${tool.toLowerCase()}-a1.png` })
      record(`${tool} 1280: opens on blank A1 without errors`, s.red.length === 0, JSON.stringify(s.fields))
      await page.keyboard.press('Escape')
      s = await openTool(page, id, tool, 'C20')
      record(`${tool} 1280: a cell in the list gives its region`, s.fields[0] === '$A$8:$K$68' || s.fields[0] === 'A8:K68', JSON.stringify(s.fields))
      await page.keyboard.press('Escape')
    }
  }
  await page.context().close()
}

// ---------- 4. 390 px: nothing important under the bottom nav pill ----------
{
  const page = await open(390, 844, { mobile: true })
  await page.goto(`${ROOT}/#/lab/sandbox`)
  await page.waitForSelector('[role=grid]')
  await page.waitForTimeout(300)
  let sheet = await rectOf(page, SHEET)
  let pill = await rectOf(page, PILL)
  record('390 sandbox: sheet and status bar clear of the pill on first view', sheet.bottom <= pill.top, `sheet ${sheet.top}-${sheet.bottom}, pill ${pill.top}`)
  await page.screenshot({ path: `${OUT}/pill-sandbox-390.png` })

  await page.goto(`${ROOT}/#/lab/w1-precedence-cafe-prices`)
  await page.waitForSelector('[role=grid]')
  await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'start' }), SHEET)
  await page.waitForTimeout(300)
  sheet = await rectOf(page, SHEET)
  pill = await rectOf(page, PILL)
  record('390 exercise: sheet clear of the pill when scrolled to it', sheet.bottom <= pill.top, `sheet ${sheet.top}-${sheet.bottom}, pill ${pill.top}`)
  await page.screenshot({ path: `${OUT}/pill-exercise-390.png` })

  await page.goto(`${ROOT}/dev/player-harness.html?view=mock&minutes=30`)
  await page.getByRole('button', { name: 'Start the exam' }).click()
  await page.waitForSelector('[role=grid]')
  await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'start' }), SHEET)
  await page.waitForTimeout(300)
  sheet = await rectOf(page, SHEET)
  pill = await rectOf(page, PILL)
  const bar = await rectOf(page, '.sticky.top-0.z-30')
  record('390 mock exam: sheet between the question bar and the pill', sheet.top >= bar.bottom && sheet.bottom <= pill.top, `bar ${bar.top}-${bar.bottom}, sheet ${sheet.top}-${sheet.bottom}, pill ${pill.top}`)
  await page.screenshot({ path: `${OUT}/pill-mock-390.png` })

  // the scroll-to-top button stays off the sheet pages, and still works elsewhere
  const topButton = async () => page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Scroll to top"]')
    return b ? getComputedStyle(b).opacity === '1' && getComputedStyle(b).pointerEvents !== 'none' : false
  })
  await page.goto(`${ROOT}/#/lab/w1-precedence-cafe-prices`)
  await page.waitForSelector('[role=grid]')
  await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'start' }), SHEET)
  await page.waitForTimeout(500)
  const onSheet = await topButton()
  await page.screenshot({ path: `${OUT}/scrolltop-exercise-390.png` })
  await page.goto(`${ROOT}/#/exam`)
  await page.getByRole('heading', { name: 'Final Exam Prep' }).waitFor()   // a hash change: wait for the lazy page
  await page.waitForTimeout(300)
  await page.evaluate(() => window.scrollTo(0, 1500))
  await page.waitForTimeout(500)
  const onExam = await topButton()
  record('390: scroll-to-top hidden on the exercise sheet, shown on /exam', !onSheet && onExam, `exercise ${onSheet}, exam ${onExam}`)
  await page.context().close()
}

await browser.close()

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
console.log(problems.length ? `console/page errors:\n  ${problems.join('\n  ')}` : 'no console or page errors')
const failed = results.filter(r => !r.ok).length
console.log(`${results.length - failed}/${results.length} checks passed; screenshots in ${OUT}`)
process.exitCode = failed || problems.length ? 1 : 0
