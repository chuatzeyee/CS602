// browser QA over EVERY Excel Lab exercise and the three mock exams: node scripts/qa-all-exercises.mjs
// Builds a production bundle into /tmp/e2e-all-dist and serves it with vite preview on :4671 (stopped at the end), so
// other agents' edits cannot hot-reload a page mid-test. DEV=1: vite dev server instead (hmr off, own dependency
// cache; React's dev warnings count as console errors). REUSE=1: test a server already on PORT. SKIP_BUILD=1: reuse
// the last bundle. NAV=spa: move between exercises by hash change (SPA navigation) instead of full page loads.
// Exercise ids come from scripts/qa-all-catalogue.ts (npx tsx); helpers live in scripts/qa-all-lib.mjs.
// Phases (PHASES=exercises,mocks,phone,perf; default all):
//   exercises  every exercise at 1280px: console errors; Check on the blank sheet (no crash, a sensible message for
//              every task); Reveal every task (VBA: the editor holds the reference macro) and Check: every task ticks
//              and the score is 100%, timed; the solved sheet shows no ####; Reset: the grid, task cards, notes, VBA
//              editor and saved state are back to the start
//   mocks      each mock: start, submit blank (0/25), review: reveal all + Check (25/25 ticked), retake
//   phone      390px: one exercise per week and the sandbox: no sideways page scroll, toolbar buttons on screen and
//              tappable, every dialog full-screen with its buttons clear of the nav pill, syntax cards on screen
//   perf       page loads of /lab, a W5 Monte Carlo exercise and /lab/sandbox (cold, warm, phone profile); the
//              heaviest Checks and a mock's marking on a 4x slower CPU (THROTTLE=<rate>)
//   regress    regressions for UI bugs fixed during this audit (run with every phase)
// ONLY=<regex> limits exercises and mocks by id. Output: /tmp/e2e-all (report.json, server.log, screenshots).
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import {
  APP, DESKTOP, DEV, OUT, PHONE, PHONE_CONTEXT, ROOT, SPA, auditDialog, auditFunctionCard, auditToolDialog, auditToolbar,
  cardStates, cards, closeBrowser, confirmDialog, displayProblems, editorHolds, errText, expect, forget, go, gridDiff,
  launch, median, messageProblems, noSideScroll, openPage, pressCheck, revealAll, session, sheetShown,
  sheetToTop, shot, startServer, statusBar, stored, sum, throttle, timeLoad, tool, toolbar, vbaEditor,
} from './qa-all-lib.mjs'

const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null
const PHASES = new Set((process.env.PHASES ?? 'exercises,mocks,phone,perf').split(',').map(s => s.trim()).concat('regress'))
const SLOW_CHECK_MS = 1500
const MOBILE_CPU = Number(process.env.THROTTLE ?? 4)

let stopServer
try {
  stopServer = await startServer()
} catch (e) {
  console.error(errText(e))
  process.exit(2)
}
const catalogue = JSON.parse(execFileSync('npx', ['tsx', 'scripts/qa-all-catalogue.ts'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }))
const allExercises = catalogue.exercises
const exercises = allExercises.filter(e => !ONLY || ONLY.test(e.id))
const mocks = catalogue.mocks.filter(m => !ONLY || ONLY.test(m.id))
await launch()
const P = () => session.page
const { errors, nativeDialogs, warnings } = session

const report = {
  started: new Date().toISOString(), mode: DEV ? 'dev' : 'preview', nav: SPA ? 'spa' : 'full',
  exercises: [], mocks: [], phone: [], perf: {}, regress: [],
}
const save = () => writeFileSync(`${OUT}/report.json`, JSON.stringify({
  ...report, errors, nativeDialogs, warnings: [...warnings].map(([text, at]) => ({ at, text })),
}, null, 1))
// console errors and native dialogs since mark()
const mark = () => ({ errors: errors.length, dialogs: nativeDialogs.length })
const consoleProblems = since => {
  const out = []
  const errs = errors.slice(since.errors).map(e => e.text)
  if (errs.length) out.push(`console errors: ${[...new Set(errs)].slice(0, 3).join(' || ')}`)
  const dl = nativeDialogs.slice(since.dialogs)
  if (dl.length) out.push(`native ${dl.map(d => d.type).join(', ')} dialog(s): ${dl[0].text.slice(0, 80)}`)
  return out
}
const indent = lines => (lines.length ? `\n      ${lines.join('\n      ')}` : '')

// ---------- phase: every exercise ----------
async function blankCheck(ex, rec) {
  const r = await pressCheck()
  if (r.error) throw new Error(r.error)
  rec.timings.blankCheck = r.ms
  rec.timings.blankCheckBlocked = r.longest
  const bar = (await statusBar().innerText()).trim()
  if (/Check failed/i.test(bar)) rec.problems.push(`blank Check: ${bar}`)
  if (!/\d+\/\d+ correct/.test(await toolbar().innerText())) rec.problems.push('blank Check: no score in the toolbar')
  const states = await cardStates()
  rec.blank = []
  for (const [i, t] of ex.tasks.entries()) {
    const s = states[i]
    const what = `blank Check: task ${i + 1} (${t.id})`
    rec.blank.push({ task: t.id, kind: t.kind, status: s.status, messages: s.messages })
    if (t.kind === 'explain') {
      if (s.status !== 'Waiting for your self-mark') rec.problems.push(`${what} is written but shows "${s.status}"`)
      continue
    }
    if (s.status === 'Correct') rec.problems.push(`DATA? ${what} is correct on the blank sheet`)
    else if (s.status !== 'Not yet correct') rec.problems.push(`${what} shows "${s.status}"`)
    if (s.status === 'Not yet correct' && !s.messages.length) rec.problems.push(`${what} fails without a message`)
    for (const p of messageProblems(t, s.messages)) rec.problems.push(`${what}: ${p}`)
  }
}

async function fullCheck(ex, rec) {
  const r = await pressCheck()
  if (r.error) throw new Error(r.error)
  rec.timings.check = r.ms
  rec.timings.checkBlocked = r.longest
  const states = await cardStates()
  for (const [i, s] of states.entries()) {
    const t = ex.tasks[i]
    if (s.status !== 'Correct') rec.problems.push(`after Reveal + Check task ${i + 1} (${t.id}, ${t.kind}) shows "${s.status}": ${s.messages.join(' / ')}`)
    for (const p of messageProblems(t, s.messages)) rec.problems.push(`Check: task ${i + 1}: ${p}`)
  }
  const n = ex.tasks.length
  const tb = await toolbar().innerText()
  if (!tb.includes(`${n}/${n} correct`)) rec.problems.push(`toolbar score is not ${n}/${n}: "${(tb.match(/\d+\/\d+ correct/) ?? ['none'])[0]}"`)
  const bar = (await statusBar().innerText()).trim()
  const want = n === 1 ? /The task is correct\. Well done!/ : new RegExp(`All ${n} tasks correct\\. Well done!`)
  if (!want.test(bar)) rec.problems.push(`status bar after a full score: "${bar}"`)
  if (!(await P().getByText('Every task is correct.').count())) rec.problems.push('no "Every task is correct." banner')
  // the solved sheet as a student sees it: nothing too wide for its column; errors listed for review
  const shown = await displayProblems()
  rec.display = shown
  if (shown.narrow.length) rec.problems.push(`DATA? revealed sheet shows #### (column too narrow) in ${shown.narrow.slice(0, 8).join(', ')}`)
  if (shown.errs.length) rec.warnings.push(`revealed sheet shows errors: ${shown.errs.slice(0, 8).join(', ')}`)
}

async function resetToStart(ex, rec, start) {
  await tool('Reset').click()
  await confirmDialog('Reset')
  await P().waitForFunction(() => /Sheet reset to the start/.test(document.querySelector('[role="status"][aria-label="Status bar"]')?.textContent ?? ''), null, { timeout: 20000 })
  await P().waitForTimeout(900)   // the 500 ms save debounce
  const states = await cardStates()
  const left = states.map((s, i) => ({ s, i })).filter(({ s }) => s.status !== 'unchecked')
  if (left.length) rec.problems.push(`after Reset task cards still show results: ${left.map(({ s, i }) => `${i + 1}:${s.status}`).join(', ')}`)
  if (states.some(s => s.notes.some(n => n.trim()))) rec.problems.push('after Reset a written answer is still filled in')
  if (/\d+\/\d+ correct/.test(await toolbar().innerText())) rec.problems.push('after Reset the toolbar still shows a score')
  const saved = await stored('lab', ex.id)
  if (!saved) rec.problems.push('after Reset nothing is saved (the checked state may come back on reload)')
  else if (JSON.stringify(saved.state) !== '{"edits":{}}') rec.problems.push(`after Reset the saved state is not empty: ${JSON.stringify(saved.state).slice(0, 160)}`)
  const vbaTasks = ex.tasks.filter(t => t.kind === 'vba')
  if (vbaTasks.length) {
    const last = ex.tasks[ex.tasks.length - 1]
    const same = await editorHolds((last.kind === 'vba' ? last : vbaTasks[0]).vba.starter)
    if (same === null) rec.warnings.push('after Reset the VBA editor is closed')
    else if (!same) rec.problems.push('after Reset the VBA editor does not show the starter code')
  }
  // the whole sheet, cell by cell, as at the start
  const d = gridDiff(start, (await displayProblems()).map)
  if (d.changed.length) rec.problems.push(`after Reset ${d.changed.length} cells differ from the start: ${d.changed.slice(0, 4).join('; ')}`)
  if (d.missing.length) rec.problems.push(`after Reset cells are no longer shown (rows left hidden?): ${d.missing.slice(0, 6).join(', ')}`)
  rec.timings.gridCells = d.total
}

async function testExercise(ex) {
  const rec = { id: ex.id, week: ex.week, tasks: ex.tasks.length, ok: false, problems: [], warnings: [], timings: {} }
  const since = mark()
  session.label = ex.id
  const step = async (name, fn) => {
    try {
      await fn()
    } catch (e) {
      rec.problems.push(`${name}: ${errText(e)}`)
      await shot(`FAIL-${ex.id}-${name}`)
      throw e
    }
  }
  try {
    let start
    await step('open', async () => {
      await forget('lab', ex.id)
      const t0 = Date.now()
      await go(`/lab/${ex.id}`, { spa: SPA })
      await sheetShown()
      await P().waitForFunction(n => document.querySelectorAll('aside[aria-label="Tasks"] article').length === n, ex.tasks.length, { timeout: 30000 })
      rec.timings.load = Date.now() - t0
      if (!SPA) rec.timings.gridAt = Math.round(await P().evaluate(() => window.__qaMarks?.gridcell ?? -1))
      const h2 = (await P().locator('aside[aria-label="Tasks"] h2').first().innerText()).trim()
      if (h2 !== ex.title) rec.problems.push(`heading "${h2}" is not the title "${ex.title}"`)
      const shown = await displayProblems()
      start = shown.map
      if (shown.narrow.length) rec.problems.push(`DATA? start sheet shows #### (column too narrow) in ${shown.narrow.slice(0, 8).join(', ')}`)
    })
    await step('blank-check', () => blankCheck(ex, rec))
    await step('reveal', async () => {
      const times = []
      await revealAll(ex.tasks, rec.problems, times)
      rec.timings.revealMax = Math.max(0, ...times)
      rec.timings.revealTotal = sum(times)
    })
    await step('check', () => fullCheck(ex, rec))
    await step('reset', () => resetToStart(ex, rec, start))
  } catch {
    // recorded by step()
  }
  rec.problems.push(...consoleProblems(since))
  rec.ok = rec.problems.length === 0
  if (!rec.ok) await shot(`FAIL-${ex.id}`)
  await forget('lab', ex.id)
  return rec
}

if (PHASES.has('exercises')) {
  await openPage({ viewport: DESKTOP })
  await P().goto(APP)
  await P().evaluate(() => localStorage.clear())
  for (const [i, ex] of exercises.entries()) {
    let rec
    try {
      rec = await testExercise(ex)
    } catch (e) {
      rec = { id: ex.id, week: ex.week, ok: false, problems: [`crashed the run: ${errText(e)}`], warnings: [], timings: {} }
    }
    if (P().isClosed() || errors.some(e => e.text === 'page crashed' && e.at === ex.id)) {
      await openPage({ viewport: DESKTOP })
      await P().goto(APP)
    }
    report.exercises.push(rec)
    const t = rec.timings
    console.log(`${rec.ok ? 'PASS' : 'FAIL'} ${String(i + 1).padStart(3)}/${exercises.length} ${ex.id.padEnd(40)} grid ${t.gridAt ?? t.load ?? '-'} ms  blank ${t.blankCheck ?? '-'} ms  check ${t.check ?? '-'} ms (blocked ${t.checkBlocked ?? '-'})${rec.ok ? '' : indent(rec.problems)}${indent(rec.warnings.map(w => `warn: ${w}`))}`)
    save()
  }
}

// ---------- phase: mock exams ----------
async function resultTotal() {
  const m = /(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/.exec(await P().locator('section[aria-label="Result"] p.text-3xl').innerText())
  if (!m) throw new Error('no total score in the Result panel')
  return [Number(m[1]), Number(m[2])]
}
async function openQuestion(i) {
  await P().getByRole('tab', { name: new RegExp(`^Q${i + 1}\\b`) }).click()
  await sheetShown()
  await P().waitForTimeout(250)
}

// review: reveal every task of a question and re-check: every task ticks; returns the marks ticked
async function reviewQuestion(m, q, qi, rec) {
  session.label = `${m.id}/${q.id}`
  await openQuestion(qi)
  const problems = []
  const times = []
  await revealAll(q.exercise.tasks, problems, times)
  rec.problems.push(...problems.map(p => `${q.id}: ${p}`))
  const r = await pressCheck()
  if (r.error) {
    rec.problems.push(`${q.id}: Check: ${r.error}`)
    return 0
  }
  rec.timings[`${q.id}Check`] = r.ms
  rec.timings[`${q.id}CheckBlocked`] = r.longest
  const states = await cardStates()
  let marks = 0
  for (const [ti, t] of q.exercise.tasks.entries()) {
    if (states[ti].status === 'Correct') marks += t.marks ?? 0
    else rec.problems.push(`${q.id} task ${ti + 1} (${t.id}) after Reveal + Check shows "${states[ti].status}": ${states[ti].messages.join(' / ')}`)
  }
  if (Math.abs(marks - q.marks) > 1e-9) rec.problems.push(`${q.id}: ticked tasks are worth ${marks}, the question ${q.marks}`)
  const shown = await displayProblems()
  if (shown.narrow.length) rec.problems.push(`DATA? ${q.id} revealed sheet shows #### (column too narrow) in ${shown.narrow.slice(0, 8).join(', ')}`)
  if (shown.errs.length) rec.notes.push(`${q.id} revealed sheet shows errors: ${shown.errs.slice(0, 8).join(', ')}`)
  rec.notes.push(`${q.id}: ${marks}/${q.marks} ticked (reveals ${sum(times)} ms, Check ${r.ms} ms, blocked ${r.longest} ms)`)
  return marks
}

async function testMock(m) {
  const rec = { id: m.id, ok: false, problems: [], notes: [], timings: {} }
  const since = mark()
  session.label = m.id
  const total = sum(m.questions.map(q => q.marks))
  const written = sum(m.questions.flatMap(q => q.exercise.tasks.filter(t => t.kind === 'explain').map(t => t.marks ?? 0)))
  try {
    await forget('mock', m.id)
    await go(`/exam/mock/${m.id}`)
    await P().getByRole('button', { name: /Start the exam/ }).click()
    await sheetShown()
    if (!(await P().getByRole('timer').count())) rec.problems.push('no timer while running')
    if (await tool('Check').count()) rec.problems.push('Check is shown during the exam')
    if (await P().getByRole('button', { name: /^Reveal/ }).count()) rec.problems.push('Reveal is shown during the exam')

    // submit blank: 0/25
    await P().getByRole('button', { name: 'Submit', exact: true }).click()
    const t0 = Date.now()
    await confirmDialog('Submit')
    await P().getByText(/^Submitted$/).waitFor({ timeout: 120000 })
    rec.timings.submitBlank = Date.now() - t0
    const [got, max] = await resultTotal()
    if (got !== 0 || max !== total) rec.problems.push(`blank submit scored ${got}/${max}, expected 0/${total}`)
    if (total !== 25) rec.problems.push(`DATA? the paper is worth ${total} marks, not 25`)
    rec.notes.push(`blank submit ${got}/${max} (marked in ${rec.timings.submitBlank} ms)`)

    let ticked = 0
    for (const [qi, q] of m.questions.entries()) ticked += await reviewQuestion(m, q, qi, rec)
    session.label = m.id
    if (Math.abs(ticked - total) > 1e-9) rec.problems.push(`review re-check ticks ${ticked}/${total}`)
    rec.notes.push(`review re-check ${ticked}/${total}`)
    const [afterSelfMark] = await resultTotal()
    if (Math.abs(afterSelfMark - written) > 1e-9) rec.problems.push(`self-marking the written answers gave ${afterSelfMark}, expected ${written}`)

    // retake: back to the intro, answers cleared, best kept, a fresh timer
    await P().getByRole('button', { name: 'Retake' }).click()
    await confirmDialog('Retake')
    await P().getByRole('button', { name: /Start the exam/ }).waitFor()
    if (!/Best\s+\d/.test(await P().locator('main').innerText())) rec.problems.push('no best score on the intro after Retake')
    const saved = await stored('mock', m.id)
    if (!saved || Object.keys(saved.states ?? {}).length || saved.startedAt || saved.submittedAt) rec.problems.push(`after Retake the saved attempt is not cleared: ${JSON.stringify(saved).slice(0, 120)}`)
    await P().getByRole('button', { name: /Start the exam/ }).click()
    await sheetShown()
    const timer = (await P().getByRole('timer').innerText()).trim()
    if (!/^(2:00:00|1:59:\d\d)$/.test(timer)) rec.problems.push(`the retake's timer reads ${timer}`)
    rec.notes.push(`retake timer ${timer}`)
  } catch (e) {
    rec.problems.push(`aborted: ${errText(e)}`)
  }
  rec.problems.push(...consoleProblems(since))
  rec.ok = rec.problems.length === 0
  if (!rec.ok) await shot(`FAIL-${m.id}`)
  await forget('mock', m.id)
  return rec
}

if (PHASES.has('mocks')) {
  await openPage({ viewport: DESKTOP })
  await P().goto(APP)
  for (const m of mocks) {
    const rec = await testMock(m)
    report.mocks.push(rec)
    console.log(`${rec.ok ? 'PASS' : 'FAIL'} mock ${m.id}: ${rec.notes.join('; ')}${rec.ok ? '' : indent(rec.problems)}`)
    save()
  }
}

// ---------- phase: phone 390px ----------
// the toolbar's VBA button toggles the panel, and selecting a VBA task has already opened it
async function openVba() {
  if (!(await vbaEditor().count())) await tool('VBA').click()
  await vbaEditor().waitFor()
}

async function phoneExercise(ex) {
  const rec = { page: `/lab/${ex.id}`, week: ex.week, ok: false, problems: [], dialogs: [] }
  const since = mark()
  session.label = `phone ${ex.id}`
  const p = rec.problems
  try {
    await forget('lab', ex.id)
    await go(`/lab/${ex.id}`)
    await sheetShown()
    await P().waitForTimeout(300)
    await noSideScroll('top of the page', p)
    await shot(`phone-${ex.id}-top`)
    // a function chip's syntax card, then the second task expands and "Go to the sheet" brings the grid up
    const withChip = ex.tasks.findIndex(t => t.chips)
    if (withChip >= 0) {
      await cards().nth(withChip).locator('button').first().click()
      const chip = await auditFunctionCard(cards().nth(withChip), p)
      if (chip) rec.dialogs.push(`${chip} syntax card`)
    }
    if (ex.tasks.length > 1) {
      await cards().nth(1).locator('button').first().click()
      await P().waitForTimeout(200)
      const go2 = cards().nth(1).getByRole('button', { name: 'Go to the sheet' })
      if (await go2.count()) {
        await go2.click()
        await P().waitForTimeout(800)
        const top = await P().locator('section[aria-label="Spreadsheet"]').evaluate(el => el.getBoundingClientRect().top)
        if (Math.abs(top) > 40) p.push(`"Go to the sheet" leaves the sheet at y=${Math.round(top)}`)
      }
      await noSideScroll('task 2 expanded', p)
    }
    rec.toolbarButtons = await auditToolbar('toolbar', p)
    await shot(`phone-${ex.id}-sheet`)
    const first = ex.tasks.findIndex(t => t.kind !== 'explain')
    if (first >= 0) {
      await cards().nth(first).locator('button').first().click()
      await cards().nth(first).getByRole('button', { name: /^Reveal/ }).click()
      const dlg = P().getByRole('alertdialog')
      await auditDialog(dlg, 'Reveal confirm', p)
      await shot(`phone-${ex.id}-reveal-confirm`)
      rec.dialogs.push('Reveal confirm')
      await dlg.getByRole('button', { name: 'Cancel', exact: true }).click()
      await dlg.waitFor({ state: 'detached' })
    }
    const tools = new Set(ex.tasks.filter(t => t.kind === 'tool' && t.tool).map(t => t.tool))
    if (ex.tasks.some(t => t.kind === 'criteria')) tools.add('advfilter')
    for (const t of tools) rec.dialogs.push(await auditToolDialog(t, `${ex.id} ${t} dialog`, p))
    if (ex.tasks.some(t => t.kind === 'vba')) {
      await sheetToTop()
      await openVba()
      await P().waitForTimeout(300)
      await noSideScroll('VBA editor open', p)
      const eb = await vbaEditor().boundingBox()
      if (!eb || eb.width < 200 || eb.x < 0 || eb.x + eb.width > PHONE.width + 0.5) p.push(`VBA editor box ${JSON.stringify(eb)}`)
      await shot(`phone-${ex.id}-vba`)
      rec.dialogs.push('VBA panel')
    }
    await tool('Reset').click()
    const reset = P().getByRole('alertdialog')
    await auditDialog(reset, 'Reset confirm', p)
    rec.dialogs.push('Reset confirm')
    await reset.getByRole('button', { name: 'Cancel', exact: true }).click()
    await reset.waitFor({ state: 'detached' })
  } catch (e) {
    p.push(`aborted: ${errText(e)}`)
  }
  p.push(...consoleProblems(since))
  rec.ok = p.length === 0
  if (!rec.ok) await shot(`FAIL-phone-${ex.id}`)
  return rec
}

async function phoneSandbox() {
  const rec = { page: '/lab/sandbox', ok: false, problems: [], dialogs: [] }
  const since = mark()
  session.label = 'phone sandbox'
  const p = rec.problems
  try {
    await forget('lab', 'sandbox')
    await go('/lab/sandbox')
    await sheetShown()
    await P().waitForTimeout(300)
    await noSideScroll('sandbox', p)
    rec.toolbarButtons = await auditToolbar('sandbox toolbar', p)
    await shot('phone-sandbox')
    for (const t of ['goalseek', 'datatable', 'solver', 'sort', 'autofilter', 'advfilter', 'pivot']) {
      rec.dialogs.push(await auditToolDialog(t, `sandbox ${t} dialog`, p))
    }
    await sheetToTop()
    await toolbar().getByRole('button', { name: /^Number format/ }).click()
    await P().getByRole('menuitem', { name: /^Custom/ }).click()
    const fmt = P().getByRole('dialog', { name: 'Format Cells: Custom', exact: true })
    await auditDialog(fmt, 'sandbox Custom format dialog', p)
    rec.dialogs.push('Format Cells: Custom')
    await fmt.getByRole('button', { name: 'Close', exact: true }).first().click()
    await sheetToTop()
    await openVba()
    await P().waitForTimeout(300)
    await noSideScroll('sandbox VBA editor open', p)
    await shot('phone-sandbox-vba')
    rec.dialogs.push('VBA panel')
    await tool('Reset').click()
    const reset = P().getByRole('alertdialog')
    await auditDialog(reset, 'sandbox Clear confirm', p)
    rec.dialogs.push('Clear confirm')
    await reset.getByRole('button', { name: 'Cancel', exact: true }).click()
  } catch (e) {
    p.push(`aborted: ${errText(e)}`)
  }
  p.push(...consoleProblems(since))
  rec.ok = p.length === 0
  if (!rec.ok) await shot('FAIL-phone-sandbox')
  return rec
}

const logPhone = rec => console.log(`${rec.ok ? 'PASS' : 'FAIL'} phone ${rec.page} (${rec.toolbarButtons ?? 0} toolbar buttons; ${rec.dialogs.join(', ')})${rec.ok ? '' : indent(rec.problems)}`)

if (PHASES.has('phone')) {
  await openPage(PHONE_CONTEXT)
  await P().goto(APP)
  // one exercise per week: the one using the most tools (W9: a VBA exercise)
  const toolCount = e => new Set(e.tasks.map(t => t.tool ?? (t.kind === 'criteria' ? 'advfilter' : t.kind === 'vba' ? 'vba' : null)).filter(Boolean)).size
  for (const w of [...new Set(allExercises.map(e => e.week))]) {
    const pool = allExercises.filter(e => e.week === w && (!ONLY || ONLY.test(e.id)))
    if (!pool.length) continue
    const rec = await phoneExercise([...pool].sort((a, b) => toolCount(b) - toolCount(a) || b.tasks.length - a.tasks.length)[0])
    report.phone.push(rec)
    logPhone(rec)
    save()
  }
  const sb = await phoneSandbox()
  report.phone.push(sb)
  logPhone(sb)
  save()
}

// ---------- phase: performance ----------
// reveal-all + Check on a slower CPU (the Check button keeps a 300 ms minimum: the main-thread block is the cost)
async function throttledChecks(ex) {
  await openPage({ viewport: DESKTOP })
  await P().goto(APP)
  await forget('lab', ex.id)
  await throttle(MOBILE_CPU, false)
  session.label = `perf throttled ${ex.id}`
  await go(`/lab/${ex.id}`)
  await sheetShown(120000)
  const blank = await pressCheck()
  const problems = []
  const times = []
  await revealAll(ex.tasks, problems, times)
  const full = await pressCheck()
  await forget('lab', ex.id)
  return { id: ex.id, blank, full, revealMax: Math.max(0, ...times), problems }
}

// marking a mock on Submit checks every question in one go
async function throttledMockSubmit(m) {
  await openPage({ viewport: DESKTOP })
  await P().goto(APP)
  await forget('mock', m.id)
  await throttle(MOBILE_CPU, false)
  session.label = `perf throttled ${m.id}`
  await go(`/exam/mock/${m.id}`)
  await P().getByRole('button', { name: /Start the exam/ }).click({ timeout: 60000 })
  await sheetShown(120000)
  await P().getByRole('button', { name: 'Submit', exact: true }).click()
  const t0 = Date.now()
  await confirmDialog('Submit', { timeout: 120000 })
  await P().getByText(/^Submitted$/).waitFor({ timeout: 180000 })
  const ms = Date.now() - t0
  await forget('mock', m.id)
  return { id: m.id, ms }
}

if (PHASES.has('perf')) {
  const w5 = allExercises
    .filter(e => e.week === 'W5' && e.tasks.some(t => t.kind === 'tool' && t.tool === 'datatable' && t.random))
    .sort((a, b) => b.tasks.length - a.tasks.length)[0]
  const targets = [['/lab', 'catalogue'], [`/lab/${process.env.PERF_EX ?? w5?.id}`, 'gridcell'], ['/lab/sandbox', 'gridcell']]
  for (const [path, mark] of targets) {
    session.label = `perf ${path}`
    await openPage({ viewport: DESKTOP })
    const cold = await timeLoad(path, mark)
    const warm = []
    for (let i = 0; i < 3; i++) warm.push(await timeLoad(path, mark))
    await openPage(PHONE_CONTEXT)
    await throttle(MOBILE_CPU, true)
    const mobile = await timeLoad(path, mark)
    report.perf[path] = { cold, warm, warmReadyMedian: median(warm.map(w => w.ready)), mobile }
    console.log(`perf ${path}: cold ready ${cold.ready} ms (${cold.scripts} scripts, ${cold.jsKB} KB over the wire, ${cold.jsDecodedKB} KB decoded); warm ready median ${report.perf[path].warmReadyMedian} ms; phone profile (${MOBILE_CPU}x CPU, slow 4G) cold ready ${mobile.ready} ms`)
  }
  const checks = report.exercises.flatMap(r => [
    { id: r.id, what: 'Check', ms: r.timings?.check, blocked: r.timings?.checkBlocked },
    { id: r.id, what: 'blank Check', ms: r.timings?.blankCheck, blocked: r.timings?.blankCheckBlocked },
  ]).concat(report.mocks.flatMap(m => Object.entries(m.timings).filter(([k]) => /Check$/.test(k))
    .map(([k, ms]) => ({ id: `${m.id}/${k.replace(/Check$/, '')}`, what: 'review Check', ms, blocked: m.timings[`${k}Blocked`] }))))
    .filter(c => typeof c.ms === 'number')
    .sort((a, b) => (b.blocked ?? 0) - (a.blocked ?? 0) || b.ms - a.ms)
  report.perf.slowChecks = checks.filter(c => c.ms > SLOW_CHECK_MS)
  report.perf.topChecks = checks.slice(0, 12)
  const heavy = [...new Set(checks.filter(c => !c.id.startsWith('mock-')).map(c => c.id))].slice(0, 8)
  const pick = heavy.length ? heavy : [
    'w6-kiosk-staffing', 'w6-carwash-resample-bays', 'w2-exam-instant-camera', 'w5-generator-sizing-exam',
    'w6-kiosk-replications', 'w6-repair-balk-renege', 'w5-rainwater-tank-exam', 'w5-mystery-locker-switch',
  ]
  report.perf.throttledChecks = []
  for (const id of pick) {
    const ex = allExercises.find(e => e.id === id)
    if (!ex) continue
    try {
      const r = await throttledChecks(ex)
      report.perf.throttledChecks.push(r)
      console.log(`perf ${MOBILE_CPU}x CPU ${id}: blank Check ${r.blank.ms} ms (blocked ${r.blank.longest}), full Check ${r.full.ms} ms (blocked ${r.full.longest}), slowest Reveal ${r.revealMax} ms${r.problems.length ? `; ${r.problems.join('; ')}` : ''}`)
    } catch (e) {
      console.log(`perf ${MOBILE_CPU}x CPU ${id}: ${errText(e)}`)
    }
  }
  const mock = catalogue.mocks.find(m => m.id === (process.env.PERF_MOCK ?? 'mock-b')) ?? catalogue.mocks[0]
  if (mock) {
    try {
      report.perf.throttledMockSubmit = await throttledMockSubmit(mock)
      console.log(`perf ${MOBILE_CPU}x CPU ${mock.id}: marking a blank submit took ${report.perf.throttledMockSubmit.ms} ms`)
    } catch (e) {
      console.log(`perf ${MOBILE_CPU}x CPU mock submit: ${errText(e)}`)
    }
  }
  save()
}

// ---------- regressions for UI bugs fixed in this audit ----------
async function regress(name, fn) {
  const since = mark()
  session.label = `regress ${name}`
  let error = ''
  try {
    await fn()
  } catch (e) {
    error = errText(e)
    await shot(`FAIL-regress-${name}`)
  }
  if (!error) error = consoleProblems(since).join('; ')
  report.regress.push({ name, ok: !error, error })
  console.log(`${error ? 'FAIL' : 'PASS'} regression: ${name}${indent(error ? [error] : [])}`)
  save()
}

if (PHASES.has('regress')) {
  await openPage({ viewport: DESKTOP })
  await P().goto(APP)
  // Player.tsx said "All 1 tasks correct" / "0 of 1 tasks correct" for one-task exercises
  const one = allExercises.find(e => e.tasks.length === 1 && e.tasks[0].kind !== 'explain')
  if (one) {
    await regress(`a one-task exercise reads "1 task", not "All 1 tasks" (${one.id})`, async () => {
      await forget('lab', one.id)
      await go(`/lab/${one.id}`)
      await sheetShown()
      let r = await pressCheck()
      expect(!r.error, r.error)
      let bar = (await statusBar().innerText()).trim()
      expect(/0 of 1 task correct/.test(bar) && !/tasks/.test(bar), `blank status bar: "${bar}"`)
      await cards().first().getByRole('button', { name: /^Reveal/ }).click()
      await confirmDialog('Reveal')
      r = await pressCheck()
      expect(!r.error, r.error)
      bar = (await statusBar().innerText()).trim()
      expect(/The task is correct\. Well done!/.test(bar) && !/All 1 tasks/.test(bar), `solved status bar: "${bar}"`)
      await forget('lab', one.id)
    })
    // Lab.tsx's catalogue card told screen readers "0 of 1 tasks solved"
    await regress(`the catalogue card of a one-task exercise reads "0 of 1 task solved" (${one.id})`, async () => {
      await go('/lab')
      await P().locator('main a[href^="#/lab/w"]').first().waitFor()
      const label = await P().locator(`main a[href="#/lab/${one.id}"] [aria-label$="solved"]`).getAttribute('aria-label')
      expect(label === '0 of 1 task solved', `progress label: "${label}"`)
    })
  }
}

// ---------- report ----------
await closeBrowser()
await stopServer()
report.finished = new Date().toISOString()
save()
const failed = list => list.filter(r => !r.ok)
const exFail = failed(report.exercises)
console.log('\n========== summary ==========')
if (report.exercises.length) {
  console.log(`exercises: ${report.exercises.length - exFail.length}/${report.exercises.length} passed`)
  for (const r of exFail) console.log(`  FAIL ${r.id}${indent(r.problems)}`)
}
if (report.mocks.length) console.log(`mocks: ${report.mocks.length - failed(report.mocks).length}/${report.mocks.length} passed`)
if (report.phone.length) console.log(`phone 390px: ${report.phone.length - failed(report.phone).length}/${report.phone.length} pages passed`)
if (report.regress.length) console.log(`regressions: ${report.regress.length - failed(report.regress).length}/${report.regress.length} passed`)
if (report.perf.topChecks) {
  console.log(`heaviest Checks (UI ms / longest main-thread block ms): ${report.perf.topChecks.slice(0, 8).map(c => `${c.id} ${c.what} ${c.ms}/${c.blocked}`).join(', ')}`)
  console.log(`Checks over ${SLOW_CHECK_MS} ms: ${report.perf.slowChecks.length ? report.perf.slowChecks.map(c => `${c.id} (${c.what}) ${c.ms} ms`).join(', ') : 'none'}`)
}
if (warnings.size) console.log(`console warnings (not failures): ${[...warnings].slice(0, 6).map(([t, at]) => `${at}: ${t.slice(0, 120)}`).join(' | ')}`)
if (nativeDialogs.length) console.log(`native dialogs: ${nativeDialogs.map(d => `${d.at}: ${d.type} ${d.text.slice(0, 60)}`).join(' | ')}`)
console.log(`report: ${OUT}/report.json`)
const failures = exFail.length + failed(report.mocks).length + failed(report.phone).length + failed(report.regress).length
process.exit(failures ? 1 : 0)
