// browser checks for the lab code-review fixes: node scripts/qa-lab-review-fixes.mjs (a server must be on PORT, default 4672)
// error boundary, grid keyboard exit, colour-free marks, macro budget and output cap, Goal Seek Cancel, confirm focus,
// reduced motion, flush on reload, entry limits. Screenshots: /tmp/lab-fixer-shots.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const PORT = Number(process.env.PORT ?? 4672)
const APP = `http://localhost:${PORT}/CS602/`
const OUT = '/tmp/lab-fixer-shots'
mkdirSync(OUT, { recursive: true })
const results = []
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `: ${detail}` : ''}`) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
let loads = 0

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
async function fresh(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e.message ?? e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('dialog', d => d.dismiss().catch(() => undefined))
  return { context, page, errors }
}
const go = (page, hash) => page.goto(`${APP}?load=${++loads}#${hash}`)
const grid = page => page.locator('section[aria-label="Spreadsheet"] [role="grid"]')
const toolBtn = (page, name) => page.getByRole('toolbar', { name: 'Spreadsheet tools' }).getByRole('button', { name, exact: true })
async function select(page, ref) {
  const box = page.getByLabel('Name box')
  await box.click()
  await box.fill(ref)
  await box.press('Enter')
}
async function enter(page, ref, text) {
  await select(page, ref)
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}
const cellText = (page, r, c) => page.evaluate(([r, c]) => document.querySelector(`[role="grid"] [id$="-r${r}c${c}"]`)?.textContent ?? null, [r, c])

try {
  // 1. corrupt saved VBA code no longer blanks the app; a render error shows the boundary, not an empty #root
  {
    const { context, page, errors } = await fresh()
    await go(page, '/lab')
    await page.evaluate(() => localStorage.setItem('cs602-lab:sandbox', JSON.stringify({ state: { edits: { A1: 'kept' }, vba: { module: 5 } } })))
    await go(page, '/lab/sandbox')
    await page.locator('[role="gridcell"]').first().waitFor()
    await toolBtn(page, 'VBA').click()
    const code = await page.getByLabel('VBA code', { exact: true }).inputValue().catch(() => null)
    ok('corrupt saved VBA (a number) opens the starter macro', Boolean(code?.startsWith('Sub Hello')), code?.slice(0, 20) ?? 'no editor')
    ok('the sandbox keeps the rest of the saved work', (await cellText(page, 0, 0)) === 'kept')
    await toolBtn(page, 'VBA').click()
    // a render error inside the player: the boundary shows Reload / Clear / Back, the nav stays
    await page.evaluate(() => {
      const split = String.prototype.split
      window.__restoreSplit = () => { String.prototype.split = split }
      String.prototype.split = function (...a) { if (String(this).startsWith('Sub Hello')) throw new TypeError('boom from a test'); return split.apply(this, a) }
    })
    await toolBtn(page, 'VBA').click()
    const alert = page.getByRole('alert').filter({ hasText: 'Something went wrong here' })
    const shown = await alert.waitFor({ timeout: 5000 }).then(() => true, () => false)
    const navStill = await page.locator('nav').count()
    await page.screenshot({ path: `${OUT}/boundary.png` })
    ok('a render error shows the lab error boundary (not a blank app)', shown && navStill > 0, `nav elements: ${navStill}`)
    await page.evaluate(() => window.__restoreSplit())
    await page.getByRole('button', { name: 'Clear the sandbox and start again' }).click()
    const back = await page.locator('[role="gridcell"]').first().waitFor({ timeout: 10000 }).then(() => true, () => false)
    ok('"Clear the sandbox and start again" brings the sandbox back, cleared', back && (await cellText(page, 0, 0)) === '')
    ok('no unexpected console errors besides the forced one', errors.every(e => /boom from a test|The above error occurred|React will try/i.test(e)), errors.filter(e => !/boom/.test(e)).slice(0, 2).join(' | '))
    await context.close()
  }

  // 2. the grid is not a keyboard trap; it describes how to leave
  {
    const { context, page } = await fresh()
    await go(page, '/lab/sandbox')
    await page.locator('[role="gridcell"]').first().waitFor()
    await page.locator('[role="gridcell"]').first().click()
    await page.keyboard.press('Tab')
    const stillGrid = await page.evaluate(() => document.activeElement?.getAttribute('role'))
    const active = await page.getByLabel('Name box').inputValue()
    ok('Tab moves between cells (B1 after A1)', stillGrid === 'grid' && active === 'B1', `${stillGrid} ${active}`)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Tab')
    const after = await page.evaluate(() => ({ role: document.activeElement?.getAttribute('role'), tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim().slice(0, 30) }))
    ok('Esc then Tab leaves the grid', after.role !== 'grid', JSON.stringify(after))
    await page.locator('[role="gridcell"]').first().click()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Shift+Tab')
    const back = await page.evaluate(() => document.activeElement?.getAttribute('role'))
    ok('Esc then Shift+Tab leaves the grid backwards', back !== 'grid', String(back))
    const describedBy = await grid(page).getAttribute('aria-describedby')
    const help = describedBy ? await page.evaluate(id => document.getElementById(id)?.textContent ?? '', describedBy) : ''
    ok('the grid describes how to leave it', /Escape .*then Tab/s.test(help), help.replace(/\s+/g, ' ').slice(0, 80))
    await context.close()
  }

  // 3. checked cells: a wrong cell is dashed, aria-invalid and described; right cells are described too
  {
    const { context, page } = await fresh()
    await go(page, '/lab/w1-sum-average-scores')
    const found = await page.locator('[role="gridcell"]').first().waitFor({ timeout: 15000 }).then(() => true, () => false)
    if (!found) {
      await go(page, '/lab')
      const first = await page.locator('main a[href^="#/lab/w1"]').first().getAttribute('href')
      await go(page, first.replace(/^#/, ''))
      await page.locator('[role="gridcell"]').first().waitFor()
    }
    await toolBtn(page, 'Check').click()
    await page.getByRole('toolbar', { name: 'Spreadsheet tools' }).getByText(/\d+\/\d+ correct/).waitFor({ timeout: 20000 })
    const marks = await page.evaluate(() => [...document.querySelectorAll('[role="gridcell"][aria-describedby]')].map(el => ({
      invalid: el.getAttribute('aria-invalid'), outline: getComputedStyle(el).outlineStyle, desc: document.getElementById(el.getAttribute('aria-describedby'))?.textContent,
    })))
    const bad = marks.filter(m => m.invalid === 'true')
    await page.screenshot({ path: `${OUT}/marks.png` })
    ok('a wrong cell is marked by a dashed edge, aria-invalid and a description', bad.length > 0 && bad.every(m => m.outline === 'dashed' && /not right yet/.test(m.desc ?? '')), `${bad.length} wrong of ${marks.length} marked`)
    await context.close()
  }

  // 4. macros: a slow endless loop stops near 5 s; endless printing keeps 1,000 lines; an InputBox loop stops
  {
    const { context, page } = await fresh()
    await go(page, '/lab/sandbox')
    await page.locator('[role="gridcell"]').first().waitFor()
    await toolBtn(page, 'VBA').click()
    const editor = page.getByLabel('VBA code', { exact: true })
    const run = async (code, timeout = 60000) => {
      await editor.fill(code)
      const t0 = Date.now()
      await page.getByRole('button', { name: /^Run/ }).click()
      await page.locator('section[aria-label="Output"]').getByText(/steps/).waitFor({ timeout })
      await page.getByRole('button', { name: /^Run/ }).and(page.locator(':not([disabled])')).waitFor({ timeout })
      return Date.now() - t0
    }
    const slow = await run('Sub Slow()\n    Dim i As Long\n    For i = 1 To 100000\n        Range("A1:Z100").Value = i\n    Next\nEnd Sub\n', 120000)
    const slowText = await page.locator('section[aria-label="Output"]').innerText()
    ok('a slow endless macro stops near its 5 s budget', slow < 9000 && /Macro stopped after 5 seconds/.test(slowText), `${slow} ms`)
    const print = await run('Sub P()\n    Dim i As Long\n    For i = 1 To 10000000\n        Debug.Print i\n    Next\nEnd Sub\n', 120000)
    const lis = await page.locator('section[aria-label="Output"] li').count()
    const note = await page.locator('section[aria-label="Output"]').getByText(/earlier lines not shown/).innerText().catch(() => '')
    const live = await page.locator('section[aria-label="Output"] [aria-live]').innerText()
    const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0)
    ok('endless Debug.Print keeps the last 1,000 lines, says how many were dropped and announces only a summary',
      lis === 1000 && /^[\d,]+ earlier lines not shown/.test(note) && live.length < 120, `${print} ms, ${lis} lines, "${note}", live "${live}", heap ${Math.round(heap / 1e6)} MB`)
    await context.close()
  }
  {
    const { context, page } = await fresh()
    let prompts = 0
    page.removeAllListeners('dialog')
    page.on('dialog', async d => { prompts += 1; await d.accept('again') })
    await go(page, '/lab/sandbox')
    await page.locator('[role="gridcell"]').first().waitFor()
    await toolBtn(page, 'VBA').click()
    await page.getByLabel('VBA code', { exact: true }).fill('Sub Ask()\n    Dim s As String\n    Do\n        s = InputBox("Code?")\n    Loop Until s = "stop"\nEnd Sub\n')
    await page.getByRole('button', { name: /^Run/ }).click()
    await page.locator('section[aria-label="Output"]').getByText(/InputBox prompts/).first().waitFor({ timeout: 30000 })
    ok('an endless InputBox loop stops after 30 prompts', prompts === 30, `${prompts} prompts`)
    await context.close()
  }

  // 5. Goal Seek Cancel keeps an entry typed while its result dialog was open
  {
    const { context, page } = await fresh()
    await go(page, '/lab/sandbox')
    await page.locator('[role="gridcell"]').first().waitFor()
    await enter(page, 'A1', '5')
    await enter(page, 'B1', '=A1*2')
    await toolBtn(page, 'What-If Analysis').click()
    await page.getByRole('menuitem', { name: 'Goal Seek…' }).click()
    const dlg = page.getByRole('dialog', { name: 'Goal Seek', exact: true })
    await dlg.getByRole('textbox', { name: 'Set cell:' }).fill('B1')
    await dlg.getByRole('textbox', { name: 'To value:' }).fill('20')
    await dlg.getByRole('textbox', { name: 'By changing cell:' }).fill('A1')
    await dlg.getByRole('button', { name: 'OK', exact: true }).click()
    const status = page.getByRole('dialog', { name: 'Goal Seek Status' })
    await status.waitFor()
    const seeked = await cellText(page, 0, 0)
    await enter(page, 'D2', '999')
    await status.getByRole('button', { name: 'Cancel', exact: true }).click()
    await sleep(200)
    const a1 = await cellText(page, 0, 0)
    const d2 = await cellText(page, 1, 3)
    ok('Goal Seek Cancel restores A1 and keeps D2 typed meanwhile', seeked === '10' && a1 === '5' && d2 === '999', `A1 ${seeked} -> ${a1}, D2 ${d2}`)
    // confirmations of destructive actions start on Cancel
    await toolBtn(page, 'Reset').click()
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim())
    ok('Clear the sandbox? starts with Cancel focused', focused === 'Cancel', String(focused))
    await page.keyboard.press('Enter')
    ok('Enter on that dialog cancels (the sheet keeps D2)', (await cellText(page, 1, 3)) === '999')
    await context.close()
  }

  // 6. reduced motion: no marching-ants animation; saved at once on reload; entry limits answer quickly
  {
    const { context, page } = await fresh({ reducedMotion: 'reduce' })
    await go(page, '/lab/sandbox')
    await page.locator('[role="gridcell"]').first().waitFor()
    await enter(page, 'A1', 'x')
    await select(page, 'A1')
    await page.keyboard.press('Control+c')
    const ants = await page.evaluate(() => ({ svg: document.querySelectorAll('svg rect[stroke-dasharray]').length, anim: document.querySelectorAll('svg animate').length }))
    ok('marching ants do not move when reduced motion is on', ants.svg > 0 && ants.anim === 0, JSON.stringify(ants))
    await page.keyboard.press('Escape')
    await enter(page, 'C3', 'second')
    await sleep(120)
    await page.reload()
    await page.locator('[role="gridcell"]').first().waitFor()
    ok('an entry committed 120 ms before a reload is saved', (await cellText(page, 2, 2)) === 'second')
    const t0 = Date.now()
    await enter(page, 'E1', '=SEQUENCE(5000,5000)')
    await sleep(100)
    ok('=SEQUENCE(5000,5000) answers at once with #VALUE!', (await cellText(page, 0, 4)) === '#VALUE!' && Date.now() - t0 < 3000, `${Date.now() - t0} ms`)
    await select(page, 'E2')
    await page.keyboard.type('=SUM(A2:Z10000)')
    await page.keyboard.press('Enter')
    const toast = await page.getByRole('status').filter({ hasText: 'past the edge' }).first().innerText({ timeout: 3000 }).catch(() => '')
    ok('=SUM(A2:Z10000) is refused with a clear message', /Z10000 is past the edge/.test(toast), toast)
    await page.keyboard.press('Escape')
    await context.close()
  }
} catch (e) {
  ok('script', false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' '))
} finally {
  await browser.close()
}
const failed = results.filter(r => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
