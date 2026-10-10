// helpers for scripts/qa-all-exercises.mjs: settings, the vite server, one browser session (console errors, warnings,
// native dialogs) and the lab page helpers (task cards, Check timing, grid snapshots, phone layout audits)
import { chromium } from 'playwright-core'
import { build, createLogger, createServer, preview } from 'vite'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const env = process.env
export const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const PORT = Number(env.PORT ?? 4671)
export const APP = `http://localhost:${PORT}/CS602/`
export const OUT = env.OUT ?? '/tmp/e2e-all'
export const DIST = env.DIST ?? '/tmp/e2e-all-dist'
export const DEV = env.DEV === '1'
export const SPA = env.NAV === 'spa'
export const DESKTOP = { width: 1280, height: 900 }
export const PHONE = { width: 390, height: 844 }
export const PHONE_CONTEXT = { viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
mkdirSync(OUT, { recursive: true })

export const sleep = ms => new Promise(r => setTimeout(r, ms))
export const errText = e => String(e?.message ?? e).split('\n')[0]
export const norm = s => String(s ?? '').replace(/\s+/g, '').toUpperCase()
export const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
export const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
export const sum = xs => xs.reduce((a, b) => a + b, 0)
export const expect = (cond, msg) => {
  if (!cond) throw new Error(msg)
}
const colName = i => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
// grid keys are 'row:col' (0-based)
export const refOfKey = k => {
  const [r, c] = k.split(':').map(Number)
  return `${colName(c)}${r + 1}`
}

// ---------- server: production preview (default), dev server (DEV=1) or one already running (REUSE=1) ----------
async function up() {
  try {
    return (await fetch(APP)).ok
  } catch {
    return false
  }
}

export async function startServer() {
  const log = `${OUT}/server.log`
  writeFileSync(log, '')
  const logger = createLogger('info')
  for (const level of ['info', 'warn', 'error']) logger[level] = msg => appendFileSync(log, `${level} ${msg}\n`)
  logger.warnOnce = msg => appendFileSync(log, `warn ${msg}\n`)
  if (env.REUSE === '1') {
    if (!(await up())) throw new Error(`REUSE=1 but nothing answers on ${APP}`)
    return async () => undefined
  }
  if (await up()) throw new Error(`port ${PORT} is already in use: stop that server, or run with REUSE=1 to test against it`)
  let server
  if (DEV) {
    server = await createServer({
      root: ROOT, cacheDir: `${OUT}/.vite`, customLogger: logger,
      server: { port: PORT, strictPort: true, hmr: false },
      optimizeDeps: { entries: ['index.html'] },   // pre-bundle up front: no "optimized dependencies changed" reload mid-test
    })
    await server.listen()
  } else {
    if (env.SKIP_BUILD !== '1') {
      // another agent saving a file mid-build can break one build: try twice
      for (let attempt = 1; ; attempt++) {
        try {
          await build({ root: ROOT, customLogger: logger, logLevel: 'warn', build: { outDir: DIST, emptyOutDir: true } })
          break
        } catch (e) {
          if (attempt >= 2) throw e
          await sleep(3000)
        }
      }
    }
    server = await preview({ root: ROOT, customLogger: logger, build: { outDir: DIST }, preview: { port: PORT, strictPort: true } })
  }
  for (let i = 0; i < 60 && !(await up()); i++) await sleep(250)
  return async () => {
    try {
      await server.close()
    } catch {
      // already closed
    }
  }
}

// ---------- browser session ----------
const IGNORED_ERRORS = /fonts\.(googleapis|gstatic)\.com/
export const session = {
  browser: null,
  context: null,
  page: null,
  label: 'start',         // what is being tested: tags errors, warnings and dialogs
  errors: [],             // console errors and page errors
  warnings: new Map(),    // console warnings (reported, not failures): text -> first label
  nativeDialogs: [],      // alert/confirm/prompt raised by the page (none expected)
}
const page = () => session.page

// first time key elements appear, measured from navigation start (load timings)
function markFirstPaint() {
  const marks = {}
  window.__qaMarks = marks
  const sel = {
    gridcell: '[role="gridcell"]',
    tasks: 'aside[aria-label="Tasks"] article',
    catalogue: 'main a[href^="#/lab/w"]',
    h1: 'main h1',
  }
  const look = () => {
    for (const [k, s] of Object.entries(sel)) if (!(k in marks) && document.querySelector(s)) marks[k] = performance.now()
  }
  new MutationObserver(look).observe(document, { childList: true, subtree: true })
}

export async function launch() {
  session.browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
}

export async function openPage(options) {
  await session.context?.close().catch(() => undefined)
  session.context = await session.browser.newContext(options)
  await session.context.addInitScript(markFirstPaint)
  const p = await session.context.newPage()
  session.page = p
  p.setDefaultTimeout(30000)
  p.on('console', m => {
    if (m.type() === 'error' && !IGNORED_ERRORS.test(m.text())) session.errors.push({ at: session.label, text: m.text() })
    if (m.type() === 'warning' && !session.warnings.has(m.text())) session.warnings.set(m.text(), session.label)
  })
  p.on('pageerror', e => session.errors.push({ at: session.label, text: `pageerror: ${errText(e)}` }))
  p.on('crash', () => session.errors.push({ at: session.label, text: 'page crashed' }))
  p.on('dialog', async d => {
    session.nativeDialogs.push({ at: session.label, type: d.type(), text: d.message() })
    await d.accept().catch(() => undefined)
  })
  return p
}

export async function closeBrowser() {
  await session.context?.close().catch(() => undefined)
  await session.browser?.close()
}

const width = () => page().viewportSize()?.width ?? 0
export const shot = async name => page().screenshot({ path: `${OUT}/${slug(name)}-${width()}.png` }).catch(() => undefined)

let loads = 0
export async function go(hashPath, { spa = false } = {}) {
  if (spa && page().url().startsWith(APP)) {
    await page().evaluate(p => { window.location.hash = p }, hashPath)
    return
  }
  // a fresh query string forces a full page load even when only the hash differs
  await page().goto(`${APP}?load=${++loads}#${hashPath}`)
}
export const sheetShown = (timeout = 60000) => page().locator('section[aria-label="Spreadsheet"] [role="gridcell"]').first().waitFor({ timeout })
export const forget = (kind, id) => page().evaluate(k => localStorage.removeItem(k), `cs602-${kind}:${id}`).catch(() => undefined)
export const stored = (kind, id) => page().evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), `cs602-${kind}:${id}`)

// ---------- player helpers ----------
export const toolbar = () => page().getByRole('toolbar', { name: 'Spreadsheet tools' })
export const tool = name => toolbar().getByRole('button', { name, exact: true })
export const cards = () => page().locator('aside[aria-label="Tasks"] article')
export const statusBar = () => page().getByRole('status', { name: 'Status bar' })
export const vbaEditor = () => page().getByLabel('VBA code', { exact: true })

export async function confirmDialog(button, { timeout = 60000 } = {}) {
  const dlg = page().getByRole('alertdialog')
  await dlg.waitFor()
  await dlg.getByRole('button', { name: button, exact: true }).click()
  await dlg.waitFor({ state: 'detached', timeout })
}

// every task card: status icon, messages and written answers
export const cardStates = () => page().evaluate(() => [...document.querySelectorAll('aside[aria-label="Tasks"] article')].map(a => {
  const status = ['Correct', 'Not yet correct', 'Waiting for your self-mark', 'Solved on an earlier visit']
    .find(l => a.querySelector(`[aria-label="${l}"]`)) ?? 'unchecked'
  const messages = [...a.querySelectorAll('ul li')].map(li => li.innerText.trim()).filter(Boolean)
  const notes = [...a.querySelectorAll('textarea')].map(t => t.value)
  return { status, messages, notes }
}))

// press the toolbar's Check, timed in the page: ms = click to result shown (the player keeps a 300 ms minimum);
// longest = the longest main-thread task meanwhile (the check itself)
export const pressCheck = () => page().evaluate(async () => {
  const bar = document.querySelector('[role="toolbar"][aria-label="Spreadsheet tools"]')
  const find = () => [...(bar?.querySelectorAll('button') ?? [])].find(b => /^(Check|Checking…)$/.test((b.textContent ?? '').trim()))
  const btn = find()
  if (!btn) return { error: 'no Check button' }
  if (btn.disabled) return { error: 'the Check button is disabled' }
  const long = []
  let po = null
  try {
    po = new PerformanceObserver(list => { for (const e of list.getEntries()) long.push(e.duration) })
    po.observe({ type: 'longtask' })
  } catch {
    po = null
  }
  const t0 = performance.now()
  btn.click()
  let sawBusy = false
  for (;;) {
    const b = find()
    const busy = Boolean(b && (b.textContent ?? '').includes('Checking'))
    if (busy) sawBusy = true
    if (sawBusy && !busy) break
    if (!sawBusy && performance.now() - t0 > 3000) return { error: 'Check never showed "Checking…"' }
    if (performance.now() - t0 > 180000) return { error: 'Check still busy after 180 s' }
    await new Promise(r => setTimeout(r, 8))
  }
  const ms = performance.now() - t0
  await new Promise(r => setTimeout(r, 80))
  po?.disconnect()
  return { ms: Math.round(ms), longest: Math.round(Math.max(0, ...long)) }
})

// two whole-sheet scans ('row:col' -> shown text): changed cells, and cells no longer shown (rows left hidden)
export function gridDiff(start, after) {
  const changed = []
  const missing = []
  for (const [k, v] of Object.entries(start)) {
    if (!(k in after)) missing.push(refOfKey(k))
    else if (after[k] !== v) changed.push(`${refOfKey(k)} "${v}" -> "${after[k]}"`)
  }
  return { changed, missing, total: Object.keys(start).length }
}

// every cell of the sheet as shown (the grid renders all columns of the rows in view: scroll down in steps)
const scanGrid = () => page().locator('section[aria-label="Spreadsheet"] [role="grid"]').evaluate(async g => {
  const out = new Map()
  const collect = () => {
    for (const el of g.querySelectorAll('[role="gridcell"]')) {
      const m = /-r(\d+)c(\d+)$/.exec(el.id)
      if (m) out.set(`${m[1]}:${m[2]}`, (el.innerText ?? '').trim())
    }
  }
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  g.scrollTo(0, 0)
  await frame()
  collect()
  for (let i = 0; i < 200 && g.scrollTop + g.clientHeight < g.scrollHeight - 1; i++) {
    g.scrollTop += Math.max(80, g.clientHeight - 60)
    await frame()
    collect()
  }
  g.scrollTo(0, 0)
  await frame()
  return [...out.entries()]
})

const ERROR_SHOWN = /^#(N\/A|VALUE!|DIV\/0!|REF!|NAME\?|NUM!|NULL!|CYCLE!|SPILL!|CALC!|ERROR!)$/
// the whole sheet as shown (map), cells too narrow for what they show (####) and error values, as A1 refs
export async function displayProblems() {
  const cells = await scanGrid()
  const narrow = cells.filter(([, t]) => /^#{2,}$/.test(t)).map(([k]) => refOfKey(k))
  const errs = cells.filter(([, t]) => ERROR_SHOWN.test(t)).map(([k, t]) => `${refOfKey(k)} ${t}`)
  return { narrow, errs, cells: cells.length, map: Object.fromEntries(cells) }
}

// messages after a Check must be specific, readable and never give the formula away
const ODD_TEXT = /undefined|NaN|\[object|TypeError|ReferenceError|RangeError|SyntaxError|Cannot read|is not a function|not available yet|\bnull\b|Infinity/
export function messageProblems(task, messages) {
  const out = []
  const answers = [task.solution, ...Object.values(task.solutions ?? {})].filter(s => typeof s === 'string' && s.startsWith('=') && s.length > 6)
  for (const m of messages) {
    if (m.length < 8) out.push(`short message "${m}"`)
    if (ODD_TEXT.test(m)) out.push(`odd text in "${m}"`)
    for (const s of answers) if (norm(m).includes(norm(s))) out.push(`message gives the answer away: "${m}"`)
  }
  return out
}

const sameCode = (a, b) => a.replace(/\r/g, '').trim() === b.replace(/\r/g, '').trim()

// reveal every task through its card: Reveal + confirm (explain: show the model answer and self-mark it); each card
// must tick at once, and a VBA task's editor must then hold the reference macro
export async function revealAll(tasks, problems, timings) {
  for (const [i, t] of tasks.entries()) {
    const card = cards().nth(i)
    await card.locator('button').first().click()
    const t0 = Date.now()
    if (t.kind === 'explain') {
      const show = card.getByRole('button', { name: 'Show model answer' })
      if (await show.count()) await show.click()
      await card.getByRole('button', { name: 'Got it' }).click()
    } else {
      await card.getByRole('button', { name: /^Reveal/ }).click()
      await confirmDialog('Reveal')
    }
    try {
      await page().waitForFunction(k => {
        const a = document.querySelectorAll('aside[aria-label="Tasks"] article')[k]
        return Boolean(a?.querySelector('[aria-label="Correct"]'))
      }, i, { timeout: 20000 })
    } catch {
      const s = (await cardStates())[i]
      problems.push(`task ${i + 1} (${t.id}, ${t.kind}${t.tool ? `:${t.tool}` : ''}) after Reveal shows "${s?.status}": ${(s?.messages ?? []).join(' / ')}`)
    }
    timings.push(Date.now() - t0)
    if (t.kind === 'vba' && t.vba) {
      const code = await vbaEditor().inputValue().catch(() => null)
      if (code === null) problems.push(`task ${i + 1} (${t.id}): no VBA editor after Reveal`)
      else if (!sameCode(code, t.vba.solution)) {
        problems.push(`task ${i + 1} (${t.id}): after Reveal the VBA editor does not hold the reference macro (${code.slice(0, 60).replace(/\n/g, ' ')}…)`)
      }
    }
  }
}
export const editorHolds = async code => {
  const now = await vbaEditor().inputValue().catch(() => null)
  return now === null ? null : sameCode(now, code)
}

// ---------- phone layout audits ----------
export async function noSideScroll(where, problems) {
  const o = await page().evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, iw: window.innerWidth,
  }))
  if (o.sw - o.cw > 1 || o.iw !== PHONE.width) problems.push(`${where}: the page scrolls sideways (scrollWidth ${o.sw}, clientWidth ${o.cw}, innerWidth ${o.iw})`)
}

export const sheetToTop = async () => {
  await page().locator('section[aria-label="Spreadsheet"]').evaluate(el => el.scrollIntoView({ block: 'start' }))
  await page().waitForTimeout(400)
}

// every toolbar button on screen, at least 24px, the topmost element at its centre; the number format menu on screen
export async function auditToolbar(where, problems) {
  await sheetToTop()
  const buttons = await page().evaluate(() => {
    const bar = document.querySelector('[role="toolbar"][aria-label="Spreadsheet tools"]')
    return [...(bar?.querySelectorAll('button') ?? [])].map(b => {
      const r = b.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      const on = Boolean(hit && (hit === b || b.contains(hit)))
      return {
        name: b.getAttribute('aria-label') || (b.textContent ?? '').trim(),
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        inView: r.left >= -0.5 && r.right <= window.innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5,
        covered: !b.disabled && !on, by: on || !hit ? null : `${hit.tagName.toLowerCase()}${hit.closest('nav') ? ' in nav' : ''}`,
      }
    })
  })
  if (!buttons.length) problems.push(`${where}: no toolbar buttons`)
  for (const b of buttons) {
    if (!b.inView) problems.push(`${where}: toolbar button "${b.name}" is off screen (x ${b.x}, y ${b.y}, w ${b.w})`)
    if (b.w < 24 || b.h < 24) problems.push(`${where}: toolbar button "${b.name}" is ${b.w}x${b.h}px (under 24px)`)
    if (b.covered) problems.push(`${where}: toolbar button "${b.name}" is covered by ${b.by}`)
  }
  await toolbar().getByRole('button', { name: /^Number format/ }).click()
  const menu = page().getByRole('menu')
  await menu.waitFor({ timeout: 5000 })
  const mb = await menu.boundingBox()
  if (!mb || mb.x < 0 || mb.x + mb.width > PHONE.width + 0.5) problems.push(`${where}: the number format menu sticks out (${JSON.stringify(mb)})`)
  await page().keyboard.press('Escape')
  await menu.waitFor({ state: 'detached', timeout: 5000 }).catch(() => problems.push(`${where}: Escape does not close the number format menu`))
  return buttons.length
}

// a dialog covers the screen and its header and footer buttons are on top (not under the nav pill)
export async function auditDialog(dlg, what, problems) {
  await dlg.waitFor({ timeout: 10000 })
  await page().waitForTimeout(450)   // scale-in animation
  const a = await dlg.evaluate(d => {
    const r = d.getBoundingClientRect()
    const buttons = [...d.querySelectorAll('button')].filter(b => b.getClientRects().length && !b.disabled).map(b => {
      const q = b.getBoundingClientRect()
      const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2)
      return {
        name: b.getAttribute('aria-label') || (b.textContent ?? '').trim(),
        offscreen: q.bottom > window.innerHeight + 0.5 || q.right > window.innerWidth + 0.5 || q.left < -0.5,
        covered: !(hit && (hit === b || b.contains(hit))),
        inBody: Boolean(b.closest('.overflow-y-auto')),   // may sit below the fold of the scrolling body
      }
    })
    return { x: r.left, y: r.top, w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight, buttons }
  })
  if (Math.abs(a.x) > 1 || Math.abs(a.y) > 1 || a.w < a.vw - 1 || a.h < a.vh - 1) {
    problems.push(`${what}: not full-screen (${Math.round(a.w)}x${Math.round(a.h)} at ${Math.round(a.x)},${Math.round(a.y)} in ${a.vw}x${a.vh})`)
  }
  for (const b of a.buttons.filter(x => !x.inBody)) {
    if (b.offscreen || b.covered) problems.push(`${what}: button "${b.name}" is ${b.offscreen ? 'off screen' : 'covered'}`)
  }
  await noSideScroll(what, problems)
}

// the function syntax card is a bottom sheet on phones: fully on screen, above the nav pill, Esc closes it
export async function auditFunctionCard(card, problems) {
  const chip = card.locator('button[aria-haspopup="dialog"]').first()
  if (!(await chip.count())) return null
  const name = (await chip.innerText()).trim()
  await chip.click()
  const pop = page().getByRole('dialog', { name, exact: true })
  await pop.waitFor({ timeout: 5000 })
  await page().waitForTimeout(300)
  const b = await pop.evaluate(d => {
    const r = d.getBoundingClientRect()
    const close = d.querySelector('button[aria-label="Close"]')?.getBoundingClientRect()
    const hit = close && document.elementFromPoint(close.left + close.width / 2, close.top + close.height / 2)
    return { x: r.left, right: r.right, bottom: r.bottom, top: r.top, closeOnTop: Boolean(hit && hit.closest('[role="dialog"]') === d) }
  })
  if (b.x < -0.5 || b.right > PHONE.width + 0.5 || b.top < -0.5 || b.bottom > PHONE.height + 0.5) problems.push(`${name} syntax card is off screen (${JSON.stringify(b)})`)
  if (!b.closeOnTop) problems.push(`${name} syntax card's Close button is covered`)
  await page().keyboard.press('Escape')
  await pop.waitFor({ state: 'detached', timeout: 5000 }).catch(() => problems.push(`Escape does not close the ${name} syntax card`))
  return name
}

export const DIALOG_OF = {
  goalseek: { open: async () => { await tool('What-If Analysis').click(); await page().getByRole('menuitem', { name: 'Goal Seek…' }).click() }, title: 'Goal Seek' },
  datatable: { open: async () => { await tool('What-If Analysis').click(); await page().getByRole('menuitem', { name: 'Data Table…' }).click() }, title: 'Data Table' },
  solver: { open: () => tool('Solver').click(), title: 'Solver Parameters' },
  sort: { open: () => tool('Sort').click(), title: 'Sort' },
  autofilter: { open: () => tool('Filter').click(), title: 'Filter (AutoFilter)' },
  advfilter: { open: () => tool('Advanced').click(), title: 'Advanced Filter' },
  pivot: { open: () => tool('PivotTable').click(), title: 'PivotTable' },
}

// open a tool dialog from the toolbar, audit it, close it with its Close button
export async function auditToolDialog(key, what, problems) {
  await sheetToTop()
  await DIALOG_OF[key].open()
  const dlg = page().getByRole('dialog', { name: DIALOG_OF[key].title, exact: true })
  await auditDialog(dlg, what, problems)
  await shot(`phone-${slug(what)}`)
  await dlg.getByRole('button', { name: 'Close', exact: true }).first().click()
  await dlg.waitFor({ state: 'detached', timeout: 5000 })
  return DIALOG_OF[key].title
}

// ---------- performance ----------
// a mid-range phone: a slower CPU and Lighthouse's slow-4G network (1.6 Mbit/s down, 150 ms round trip)
export async function throttle(cpu, network) {
  const cdp = await session.context.newCDPSession(page())
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  if (network) {
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  }
}

// one page load: when the marked element first appeared, navigation timings and the scripts it pulled in
export async function timeLoad(hashPath, mark) {
  const t0 = Date.now()
  await page().goto(`${APP}?perf=${++loads}#${hashPath}`)
  await page().waitForFunction(k => window.__qaMarks && k in window.__qaMarks, mark, { timeout: 90000 })
  const wall = Date.now() - t0
  return page().evaluate(([k, w]) => {
    const nav = performance.getEntriesByType('navigation')[0]
    const js = performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name))
    return {
      ready: Math.round(window.__qaMarks[k]), wall: w,
      dcl: Math.round(nav?.domContentLoadedEventEnd ?? -1), load: Math.round(nav?.loadEventEnd ?? -1),
      jsKB: Math.round(js.reduce((n, r) => n + (r.transferSize || 0), 0) / 1024),
      jsDecodedKB: Math.round(js.reduce((n, r) => n + (r.decodedBodySize || 0), 0) / 1024),
      scripts: js.length,
    }
  }, [mark, wall])
}
