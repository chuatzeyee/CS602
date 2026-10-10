// browser QA for the lab Spreadsheet on the dev harness.
// npx vite --port 4621 --strictPort   then   PORT=4621 node scripts/qa-grid.mjs
// screenshots: /tmp/cs602_grid (SHOTS=... to change); exit code 1 when a check fails or the console shows errors
// (HMR re-runs the harness when its sources change mid-run: while other files are being edited, serve without HMR)
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const PORT = process.env.PORT ?? '4621'
const URL = `http://localhost:${PORT}/CS602/dev/grid-harness.html`
const SHOTS = process.env.SHOTS ?? '/tmp/cs602_grid'
mkdirSync(SHOTS, { recursive: true })

const results = []
const consoleErrors = []
const ok = (name, cond, detail = '') => results.push({ name, ok: !!cond, detail: cond ? '' : String(detail) })

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })

function watch(page, label) {
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`[${label}] ${m.type()}: ${m.text()}`) })
  page.on('pageerror', e => consoleErrors.push(`[${label}] pageerror: ${e.message}`))
  page.on('response', r => { if (r.status() >= 400) consoleErrors.push(`[${label}] HTTP ${r.status()} ${r.url()}`) })
}

// ---------- helpers ----------
const colIdx = l => [...l].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
const parse = ref => { const m = /^([A-Z]+)(\d+)$/.exec(ref); return { r: Number(m[2]) - 1, c: colIdx(m[1]) } }
const cellSel = ref => { const { r, c } = parse(ref); return `[role=row][aria-rowindex="${r + 2}"] [role=gridcell][aria-colindex="${c + 2}"]` }

function helpers(page) {
  const h = {
    raw: ref => page.evaluate(r => window.__grid.sheet.raw(r), ref),
    display: ref => page.evaluate(r => window.__grid.sheet.display(r), ref),
    sel: () => page.evaluate(() => window.__grid.api.current.selection()),
    select: range => page.evaluate(r => window.__grid.api.current.select(r), range),
    focus: () => page.evaluate(() => window.__grid.api.current.focus()),
    cell: ref => page.locator(cellSel(ref)),
    async click(ref, opts = {}) {
      await page.evaluate(r => window.__grid.api.current.select(r), ref)   // scroll it into view first
      await page.locator(cellSel(ref)).click(opts)
    },
    editor: () => page.locator('input[aria-label^="Edit "]'),
    bar: () => page.locator('input[aria-label="Formula bar"]'),
    nameBox: () => page.locator('input[aria-label="Name box"]'),
    async editorValue() {
      const ed = page.locator('input[aria-label^="Edit "]')
      if (await ed.count()) return ed.inputValue()
      return page.locator('input[aria-label="Formula bar"]').inputValue()
    },
    toast: () => page.locator('[role=status]').first(),
    async toastText() {
      const t = page.locator('[role=status]')
      await t.first().waitFor({ timeout: 1500 }).catch(() => undefined)
      return (await t.count()) ? t.first().innerText() : ''
    },
    async waitToastGone() { await page.locator('[role=status]').first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => undefined) },
    async box(ref) { return page.locator(cellSel(ref)).boundingBox() },
    shot: name => page.screenshot({ path: `${SHOTS}/${name}.png` }),
  }
  return h
}

// ---------- desktop ----------
try {
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` })
watch(page, 'desktop')
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[role=grid]')
await page.waitForFunction(() => window.__grid?.api?.current)
const h = helpers(page)
await h.shot('01-initial')

// 1. type a formula and Enter
await h.click('D6')
await page.keyboard.type('=B6*C6')
ok('typing opens the in-cell editor', (await h.editor().count()) === 1)
ok('formula bar mirrors the in-cell editor', (await h.bar().inputValue()) === '=B6*C6', await h.bar().inputValue())
await h.shot('02-typing-formula')
await page.keyboard.press('Enter')
ok('Enter commits the formula', (await h.raw('D6')) === '=B6*C6', await h.raw('D6'))
ok('Enter moves down', (await h.sel()).active === 'D7', JSON.stringify(await h.sel()))
const d6 = await h.display('D6')
ok('cell shows the computed value', (await h.cell('D6').innerText()).trim() === d6, `${await h.cell('D6').innerText()} vs ${d6}`)

// 2. F2 edits in place with the caret at the end
await h.click('D6')
await page.keyboard.press('F2')
ok('F2 opens the editor with the formula', (await h.editorValue()) === '=B6*C6', await h.editorValue())
await page.keyboard.type('*2')
await page.keyboard.press('Enter')
ok('F2 edit appends at the caret', (await h.raw('D6')) === '=B6*C6*2', await h.raw('D6'))

// double-click edits too; Esc cancels
await h.cell('D6').dblclick()
ok('double-click opens the editor', (await h.editor().count()) === 1)
await page.keyboard.type('+1')
await page.keyboard.press('Escape')
ok('Esc cancels the edit', (await h.raw('D6')) === '=B6*C6*2' && (await h.editor().count()) === 0, await h.raw('D6'))

// 3. F4 cycles anchoring
await h.click('E6')
await page.keyboard.type('=B1')
const cyc = []
for (let i = 0; i < 4; i++) { await page.keyboard.press('F4'); cyc.push(await h.editorValue()) }
ok('F4 cycles A1 -> $A$1 -> A$1 -> $A1 -> A1', cyc.join(' ') === '=$B$1 =B$1 =$B1 =B1', cyc.join(' '))
await page.keyboard.press('Escape')
await h.click('E6')
await page.keyboard.type('=SUM(B6:C9')
await page.keyboard.press('F4')
ok('F4 anchors a range', (await h.editorValue()) === '=SUM($B$6:$C$9', await h.editorValue())
await h.shot('03-f4-range')
await page.keyboard.press('Escape')

// 4. point mode with arrow keys (and Shift+arrow for a range)
await h.click('E7')
await page.keyboard.type('=')
await page.keyboard.press('ArrowLeft')
await page.keyboard.press('ArrowLeft')
ok('arrow keys point at a cell (replacing it on the next arrow)', (await h.editorValue()) === '=C7', await h.editorValue())
await page.keyboard.type('*')
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft')
ok('after an operator arrows insert a new reference', (await h.editorValue()) === '=C7*B7', await h.editorValue())
await h.shot('04-point-mode')
await page.keyboard.press('Enter')
ok('pointed formula commits', (await h.raw('E7')) === '=C7*B7', await h.raw('E7'))
await h.click('E8')
await page.keyboard.type('=SUM(')
await page.keyboard.press('ArrowLeft')
await page.keyboard.press('Shift+ArrowUp')
await page.keyboard.press('Shift+ArrowUp')
ok('Shift+arrow extends the pointed range', (await h.editorValue()) === '=SUM(D6:D8', await h.editorValue())
await page.keyboard.type(')')
await page.keyboard.press('Enter')
ok('pointed range commits', (await h.raw('E8')) === '=SUM(D6:D8)', await h.raw('E8'))
// point by mouse drag
await h.click('E9')
await page.keyboard.type('=SUM(')
{
  const a = await h.box('B9'); const b = await h.box('C11')
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 })
  await h.shot('05-point-drag')
  await page.mouse.up()
}
ok('dragging on the grid points a range', (await h.editorValue()) === '=SUM(B9:C11', await h.editorValue())
await page.keyboard.press('Enter')
ok('missing bracket closed on Enter', (await h.raw('E9')) === '=SUM(B9:C11)', await h.raw('E9'))

// autocomplete + syntax hint
await h.click('E10')
await page.keyboard.type('=vl')
const list = page.locator('[role=listbox][aria-label="Functions"]')
ok('autocomplete lists matching functions', (await list.count()) === 1 && (await list.locator('[role=option]').first().innerText()).startsWith('VLOOKUP'))
await page.waitForTimeout(300)
await h.shot('06-autocomplete')
await page.keyboard.press('Tab')
ok('Tab inserts the function and bracket', (await h.editorValue()) === '=VLOOKUP(', await h.editorValue())
const tip = page.locator('[role=tooltip]')
ok('syntax hint shows inside FUNC(', (await tip.count()) === 1 && (await tip.innerText()).includes('lookup_value'))
await h.shot('07-syntax-hint')
await page.keyboard.press('Escape')

// 5. Ctrl+D fill down
await h.click('D6')
await page.keyboard.press('Shift+ArrowDown')
await page.keyboard.press('Shift+ArrowDown')
await page.keyboard.press('Shift+ArrowDown')
await page.keyboard.press('Shift+ArrowDown')
ok('Shift+arrows extend the selection', (await h.sel()).range === 'D6:D10', JSON.stringify(await h.sel()))
await page.keyboard.press('Control+d')
ok('Ctrl+D fills down with relative refs', (await h.raw('D10')) === '=B10*C10*2', await h.raw('D10'))

// 6. fill handle drag: formulas and a numeric series
await h.click('D10')
{
  const handle = page.locator('[data-fill-handle]')
  const hb = await handle.boundingBox()
  const t = await h.box('D15')
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 })
  await h.shot('08-fill-handle-drag')
  await page.mouse.up()
}
ok('fill handle copies the formula down', (await h.raw('D15')) === '=B15*C15*2', await h.raw('D15'))
ok('selection covers the filled range', (await h.sel()).range === 'D10:D15', JSON.stringify(await h.sel()))
await h.click('H6')
await page.keyboard.type('1')
await page.keyboard.press('Enter')
await page.keyboard.type('2')
await page.keyboard.press('Enter')
await h.click('H6')
await page.keyboard.press('Shift+ArrowDown')
{
  const handle = page.locator('[data-fill-handle]')
  const hb = await handle.boundingBox()
  const t = await h.box('H10')
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 })
  await page.mouse.up()
}
ok('fill handle extends a 1, 2 series', [await h.raw('H8'), await h.raw('H9'), await h.raw('H10')].join(',') === '3,4,5',
  [await h.raw('H8'), await h.raw('H9'), await h.raw('H10')].join(','))

// 7. copy / paste with relative adjustment
await h.click('D6')
await page.keyboard.press('Control+c')
await page.waitForTimeout(50)
ok('copy shows the marching ants', (await page.locator('svg animate').count()) >= 1)
await h.click('K6')
await h.shot('09-copy-ants')
await page.keyboard.press('Control+v')
await page.waitForTimeout(50)
ok('paste adjusts relative refs', (await h.raw('K6')) === '=I6*J6*2', await h.raw('K6'))
await page.keyboard.press('Escape')
ok('Esc clears the marching ants', (await page.locator('svg animate').count()) === 0)
// system clipboard text from outside the lab
await page.evaluate(() => navigator.clipboard.writeText('5\t6\r\n7\t8\r\n'))
await h.click('H12')
await page.keyboard.press('Control+v')
await page.waitForTimeout(50)
ok('external TSV paste fills a block', [await h.raw('H12'), await h.raw('I12'), await h.raw('H13'), await h.raw('I13')].join(',') === '5,6,7,8',
  [await h.raw('H12'), await h.raw('I12'), await h.raw('H13'), await h.raw('I13')].join(','))
// cut + paste moves
await h.click('H12')
await page.keyboard.press('Control+x')
await h.click('K12')
await page.keyboard.press('Control+v')
await page.waitForTimeout(50)
ok('cut + paste moves the cell', (await h.raw('K12')) === '5' && (await h.raw('H12')) === '', `${await h.raw('K12')} / ${await h.raw('H12')}`)

// 8. undo / redo
await h.click('K6')
await page.keyboard.press('Control+z')
await page.keyboard.press('Control+z')
await page.keyboard.press('Control+z')
const afterUndo = await h.raw('K6')
await page.keyboard.press('Control+y')
await page.keyboard.press('Control+y')
await page.keyboard.press('Control+Shift+z')
ok('undo removes the pasted formula', afterUndo === '', afterUndo)
ok('redo restores it', (await h.raw('K6')) === '=I6*J6*2' && (await h.raw('K12')) === '5', `${await h.raw('K6')} / ${await h.raw('K12')}`)

// 9. locked cells
await h.waitToastGone()
await h.click('B6')
await page.keyboard.type('5')
ok('typing on a given cell shows the locked toast', (await h.toastText()) === 'This cell is locked (given data)', await h.toastText())
await page.waitForTimeout(350)
await h.shot('10-locked-toast')
ok('locked cell unchanged', (await h.raw('B6')) !== '5')
await h.waitToastGone()
await page.keyboard.press('Delete')
ok('Delete on a given cell shows the locked toast', (await h.toastText()) === 'This cell is locked (given data)', await h.toastText())
await h.waitToastGone()
await h.click('J7')
await page.keyboard.type('1')
ok('data-table body is locked', (await h.toastText()).toLowerCase().includes('data table'), await h.toastText())
await h.waitToastGone()

// invalid formula keeps the editor open with a message
await h.click('E11')
await page.keyboard.type('=SUM(1,,')
await page.keyboard.type('+')
await page.keyboard.press('Enter')
const bad = await h.editor().count()
const badToast = await h.toastText()
ok('a rejected entry keeps the editor open with a message', bad === 1 && badToast.length > 0, `${bad} ${badToast}`)
await page.waitForTimeout(350)
await h.shot('11-rejected-entry')
await page.keyboard.press('Escape')
await h.waitToastGone()

// 10. Ctrl+arrow, Ctrl+Home, Home, PageDown, Tab, Ctrl+A
await h.click('A6')
await page.keyboard.press('Control+ArrowDown')
ok('Ctrl+Down jumps to the end of the data', (await h.sel()).active === 'A300', JSON.stringify(await h.sel()))
await h.shot('12-ctrl-down')
await page.keyboard.press('Control+ArrowUp')
ok('Ctrl+Up jumps back to the top of the block', (await h.sel()).active === 'A5', JSON.stringify(await h.sel()))
await page.keyboard.press('Control+Home')
ok('Ctrl+Home goes to A1', (await h.sel()).active === 'A1')
await page.keyboard.press('Control+ArrowRight')
ok('Ctrl+Right stops at the data edge', (await h.sel()).active === 'B1', JSON.stringify(await h.sel()))
await page.keyboard.press('Tab')
ok('Tab moves right', (await h.sel()).active === 'C1')
await page.keyboard.press('Shift+Tab')
await page.keyboard.press('Home')
ok('Home goes to column A', (await h.sel()).active === 'A1')
await page.keyboard.press('PageDown')
const pd = parse((await h.sel()).active)
ok('PageDown moves a screenful', pd.r > 10, JSON.stringify(await h.sel()))
await page.keyboard.press('Control+a')
ok('Ctrl+A selects the whole sheet', (await h.sel()).range === 'A1:K300', JSON.stringify(await h.sel()))
await page.keyboard.press('Control+Home')

// 11. name box
await h.nameBox().click()
await page.keyboard.type('J5')
await page.keyboard.press('Enter')
ok('name box selects a cell', (await h.sel()).active === 'J5')
await h.nameBox().click()
await page.keyboard.type('d200:e210')
await page.keyboard.press('Enter')
ok('name box selects (and scrolls to) a range', (await h.sel()).range === 'D200:E210' && (await h.cell('D200').count()) === 1, JSON.stringify(await h.sel()))
await h.shot('13-name-box-range')
await page.keyboard.press('ArrowDown')
ok('keyboard focus returns to the grid after the name box', (await h.sel()).active === 'D201', JSON.stringify(await h.sel()))
await h.nameBox().click()
await page.keyboard.type('Q99')
await page.keyboard.press('Enter')
ok('bad name box entry shows a message', (await h.toastText()).length > 0)
await page.keyboard.press('Escape')
await h.waitToastGone()

// error cell: red with hint chip
await h.click('E3')
const e3 = await h.cell('E3').getAttribute('title')
ok('error cell has a hint tooltip', !!e3 && e3.startsWith('#DIV/0!'), e3)
await h.shot('14-error-cell')

// formula bar editing
await h.click('E12')
await h.bar().click()
await page.keyboard.type('=B12+1')
ok('formula bar editing mirrors into the cell editor', (await h.editor().inputValue()) === '=B12+1')
await page.keyboard.press('Enter')
ok('formula bar Enter commits', (await h.raw('E12')) === '=B12+1', await h.raw('E12'))

// 12. Show Formulas
await h.click('C6')
await page.keyboard.press('Control+Backquote')
await page.waitForTimeout(50)
ok('Ctrl+` shows formulas', (await h.cell('C6').innerText()).trim() === '=$B$1*(1-$B$3)', await h.cell('C6').innerText())
await h.shot('15-show-formulas')
await page.keyboard.press('Control+Backquote')
ok('Ctrl+` toggles back', (await h.cell('C6').innerText()).trim() !== '=$B$1*(1-$B$3)')

// marks + read-only
await page.getByRole('button', { name: 'toggle marks' }).click()
await h.select('D6')
await h.shot('16-marks')
await page.getByRole('button', { name: 'toggle marks' }).click()
await page.getByRole('button', { name: 'read-only' }).click()
await h.click('E13')
await page.keyboard.type('9')
ok('read-only blocks typing', (await h.toastText()).toLowerCase().includes('read-only') && (await h.raw('E13')) === '')
await h.waitToastGone()
await page.getByRole('button', { name: 'editable' }).click()

// 13. scrolling the 300-row sheet: virtualised rows
const grid = page.locator('[role=grid]')
await grid.evaluate(el => { el.scrollTop = el.scrollHeight })
await page.waitForTimeout(150)
ok('row 300 renders after scrolling to the bottom', (await h.cell('A300').count()) === 1)
const rendered = await page.locator('[role=row]').count()
ok('only a window of rows is rendered', rendered < 120, `${rendered} rows in the DOM`)
await h.shot('17-scrolled-bottom')
await grid.evaluate(el => { el.scrollTop = 120 * 24 })
await page.waitForTimeout(150)
ok('mid-sheet rows render while frozen rows stay', (await h.cell('A130').count()) === 1 && (await h.cell('A5').count()) === 1)
const hiddenGap = (await h.cell('A20').count()) === 0
await grid.evaluate(el => { el.scrollTop = 0 })
await page.waitForTimeout(100)
ok('hidden row 20 is skipped', hiddenGap && (await h.cell('A21').count()) === 1 && (await h.cell('A20').count()) === 0)

// timing: typing a value and recomputing with ~300 rows
const t0 = Date.now()
await h.click('B1')
await page.keyboard.type('15')
await page.keyboard.press('Enter')
const dt = Date.now() - t0
ok('input edit recomputes quickly', dt < 1500, `${dt} ms`)
ok('dependent cells update', (await h.raw('B1')) === '15')
await h.shot('18-after-input-change')

// F9 re-runs the data table (Excel: automatic except tables)
const j6Before = await h.display('J6')
await page.keyboard.press('F9')
const j6After = await h.display('J6')
ok('F9 re-runs data tables after an input change', j6Before !== j6After, `${j6Before} -> ${j6After}`)

// header clicks, shift+click, drag, Ctrl+Space, Shift+Space
const colHeader = c => page.locator(`[role=columnheader][aria-colindex="${c + 2}"]`)
await colHeader(2).click()
ok('column header click selects the column', (await h.sel()).range === 'C1:C300', JSON.stringify(await h.sel()))
await colHeader(4).click({ modifiers: ['Shift'] })
ok('shift+click on a column header extends', (await h.sel()).range === 'C1:E300', JSON.stringify(await h.sel()))
await page.locator('[role=row][aria-rowindex="9"] [role=rowheader]').click()
ok('row header click selects the row', (await h.sel()).range === 'A8:K8', JSON.stringify(await h.sel()))
await h.click('B2')
await h.cell('C3').click({ modifiers: ['Shift'] })
ok('shift+click extends the selection', (await h.sel()).range === 'B2:C3', JSON.stringify(await h.sel()))
{
  const a = await h.box('E6'); const b = await h.box('F8')
  await page.mouse.move(a.x + 10, a.y + 10)
  await page.mouse.down()
  await page.mouse.move(b.x + 10, b.y + 10, { steps: 5 })
  await page.mouse.up()
}
ok('mouse drag selects a range', (await h.sel()).range === 'E6:F8', JSON.stringify(await h.sel()))
await page.keyboard.press('Control+Space')
ok('Ctrl+Space selects whole columns', (await h.sel()).range === 'E1:F300', JSON.stringify(await h.sel()))
await h.click('E7')
await page.keyboard.press('Shift+Space')
ok('Shift+Space selects the whole row', (await h.sel()).range === 'A7:K7', JSON.stringify(await h.sel()))

// Delete over a mix of editable and locked cells
await h.click('E7')
await page.keyboard.press('Shift+ArrowRight')
await page.keyboard.press('Delete')
ok('Delete clears the editable cells and says what stayed', (await h.raw('E7')) === '' && (await h.toastText()).includes('left unchanged'),
  `${await h.raw('E7')} / ${await h.toastText()}`)
await h.waitToastGone()

// Ctrl+Enter enters the formula into every selected cell
await h.click('H22')
await page.keyboard.press('Shift+ArrowDown')
await page.keyboard.press('Shift+ArrowDown')
await page.keyboard.type('=B22*2')
await page.keyboard.press('Control+Enter')
ok('Ctrl+Enter fills the selection', (await h.raw('H24')) === '=B24*2' && (await h.sel()).range === 'H22:H24',
  `${await h.raw('H24')} ${JSON.stringify(await h.sel())}`)

// double-click on the fill handle fills down beside the data
await h.click('K6')
await page.locator('[data-fill-handle]').dblclick()
ok('fill-handle double-click fills down to the end of the neighbouring data', (await h.raw('K10')) === '=I10*J10*2' && (await h.raw('K11')) === '',
  `${await h.raw('K10')} / ${await h.raw('K11')}`)
ok('fill-handle double-click does not open the editor', (await h.editor().count()) === 0 && (await h.sel()).range === 'K6:K10',
  `${await h.editor().count()} ${JSON.stringify(await h.sel())}`)
await h.shot('19-after-more-actions')
await browser.newContext().then(c => c.close())
await page.close()

// ---------- 1000-row Monte Carlo sheet: load, F9, scrolling ----------
const mc = await browser.newPage({ viewport: { width: 1280, height: 900 } })
watch(mc, 'mc')
const tLoad = Date.now()
await mc.goto(`${URL}?sheet=mc`, { waitUntil: 'networkidle' })
await mc.waitForSelector('[role=grid] [role=gridcell]')
await mc.waitForFunction(() => window.__grid?.api?.current)
const loadMs = Date.now() - tLoad
ok('mc: 1000-row sheet loads', (await mc.locator('[role=row]').count()) < 120, `${await mc.locator('[role=row]').count()} rows`)
const mh = helpers(mc)
await mh.click('B2')
const perf = await mc.evaluate(async () => {
  const grid = document.querySelector('[role=grid]')
  const text = () => document.querySelector('[role=row][aria-rowindex="3"] [role=gridcell][aria-colindex="3"]')?.textContent
  const frame = () => new Promise(r => requestAnimationFrame(() => r(undefined)))
  const out = { f9: [], scroll: [], changed: 0 }
  for (let i = 0; i < 5; i++) {
    const before = text()
    const t0 = performance.now()
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9', bubbles: true, cancelable: true }))
    await frame()
    out.f9.push(performance.now() - t0)
    if (text() !== before) out.changed++
  }
  for (const top of [6000, 12000, 18000, 23900, 0]) {
    const t0 = performance.now()
    grid.scrollTop = top
    await frame()
    await frame()
    out.scroll.push(performance.now() - t0)
  }
  return out
})
const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length)
ok('mc: F9 redraws the random numbers', perf.changed >= 4, `${perf.changed}/5 changed`)
ok('mc: F9 recalc + render stays under 400 ms', avg(perf.f9) < 400, `avg ${avg(perf.f9)} ms`)
ok('mc: scrolling renders within 120 ms per jump', Math.max(...perf.scroll) < 120, perf.scroll.map(Math.round).join(', '))
await mc.locator('[role=grid]').evaluate(el => { el.scrollTop = 0 })
await mh.click('A2')
await mc.keyboard.press('Control+ArrowDown')
ok('mc: Ctrl+Down reaches row 1000', (await mh.sel()).active === 'A1000', JSON.stringify(await mh.sel()))
await mh.shot('24-monte-carlo-bottom')
console.log(`mc timings: load ${loadMs} ms, F9 ${perf.f9.map(Math.round).join('/')} ms, scroll ${perf.scroll.map(Math.round).join('/')} ms`)
await mc.close()

// ---------- mobile 390px ----------
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
const mp = await mctx.newPage()
watch(mp, 'mobile')
await mp.goto(URL, { waitUntil: 'networkidle' })
await mp.waitForSelector('[role=grid]')
await mp.waitForFunction(() => window.__grid?.api?.current)
const m = helpers(mp)
await m.shot('20-mobile-initial')
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
ok('mobile: page has no horizontal overflow', overflow <= 1, `${overflow}px`)
const gridScroll = await mp.locator('[role=grid]').evaluate(el => el.scrollWidth - el.clientWidth)
ok('mobile: grid scrolls horizontally', gridScroll > 0, gridScroll)
await m.select('D6')
await mp.locator(cellSel('D7')).tap()
ok('mobile: tap selects', (await m.sel()).active === 'D7', JSON.stringify(await m.sel()))
await mp.waitForTimeout(600)
await mp.locator(cellSel('D8')).tap()
await mp.waitForTimeout(80)
await mp.locator(cellSel('D8')).tap({ force: true })
await mp.waitForTimeout(80)
const focusedBar = await mp.evaluate(() => document.activeElement?.getAttribute('aria-label'))
ok('mobile: double-tap edits in the formula bar', focusedBar === 'Formula bar', focusedBar)
await mp.keyboard.type('=B8*C8')
await m.shot('21-mobile-editing')
await mp.keyboard.press('Enter')
ok('mobile: formula bar entry commits', (await m.raw('D8')) === '=B8*C8', await m.raw('D8'))
await m.select('E3')
await m.shot('22-mobile-error-chip')
await mp.locator('[role=grid]').evaluate(el => { el.scrollLeft = 400; el.scrollTop = 600 })
await mp.waitForTimeout(150)
await m.shot('23-mobile-scrolled')
await mctx.close()
} catch (e) {
  ok('script ran to the end', false, e.message.split('\n')[0])
}
await browser.close()

// ---------- report ----------
const failed = results.filter(r => !r.ok)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  -> ${r.detail}`}`)
console.log(`\n${results.length - failed.length}/${results.length} checks passed; console errors/warnings: ${consoleErrors.length}`)
for (const e of consoleErrors) console.log(`  ${e}`)
process.exit(failed.length || consoleErrors.length ? 1 : 0)
