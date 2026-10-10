// exam-project browser check: screenshots + interaction checks for /exam and /project.
// usage: node scripts/check-exam-project.mjs [port]   (dev server must already be running)
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const PORT = process.argv[2] ?? '4612'
const BASE = `http://localhost:${PORT}/CS602/#`
const OUT = '/tmp/cs602_exam'
mkdirSync(OUT, { recursive: true })

const results = []
const record = (name, ok, detail = '') => results.push({ name, ok, detail })
const isFontNoise = t => /fonts\.(googleapis|gstatic)\.com/.test(t)

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })

async function openPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`) })
  page.on('pageerror', e => errors.push(`[pageerror] ${e}`))
  page.on('requestfailed', r => errors.push(`[requestfailed] ${r.url()}`))
  return { ctx, page, errors }
}

async function load(page, route, heading) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
  await page.waitForSelector(`h1:has-text("${heading}")`, { timeout: 15000 })
  await page.waitForTimeout(400)
}

async function sectionShots(page, prefix, ids) {
  for (const id of ids) {
    const el = await page.$(`#${id}`)
    if (!el) { record(`${prefix} section #${id} exists`, false); continue }
    await el.scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await el.screenshot({ path: `${OUT}/${prefix}-${id}.png` })
  }
}

for (const [width, height, tag] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
  const { ctx, page, errors } = await openPage(width, height)

  await load(page, '/exam', 'Final Exam Prep')
  await page.screenshot({ path: `${OUT}/exam-${tag}-full.png`, fullPage: true })
  await page.screenshot({ path: `${OUT}/exam-${tag}-top.png` })
  await sectionShots(page, `exam-${tag}`, ['glance', 'marking', 'time', 'strategy', 'techniques', 'papers', 'quizzes', 'mocks'])
  const examOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  record(`exam ${tag}: no horizontal overflow`, examOverflow <= 0, `overflow ${examOverflow}px`)

  await load(page, '/project', 'Group Project')
  await page.screenshot({ path: `${OUT}/project-${tag}-full.png`, fullPage: true })
  await page.screenshot({ path: `${OUT}/project-${tag}-top.png` })
  await sectionShots(page, `project-${tag}`, ['overview', 'deliverables', 'rubric', 'conventions', 'drills', 'past', 'data', 'faq'])
  const projOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  record(`project ${tag}: no horizontal overflow`, projOverflow <= 0, `overflow ${projOverflow}px`)

  const real = errors.filter(e => !isFontNoise(e))
  record(`${tag}: no console errors/warnings`, real.length === 0, real.join(' | ') || `${errors.length} font-only messages ignored`)
  await ctx.close()
}

// interactions (desktop)
{
  const { ctx, page, errors } = await openPage(1280, 900)
  await load(page, '/exam', 'Final Exam Prep')
  await page.evaluate(() => { localStorage.removeItem('cs602-exam-checklist'); localStorage.removeItem('cs602-project-checklist') })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('h1:has-text("Final Exam Prep")')

  const count = () => page.textContent('[data-testid="exam-checklist-count"]')
  record('exam checklist starts empty', (await count()).trim() === '0/16 ready', await count())
  await page.click('label:has([data-strategy="crf-first"])')
  record('exam checklist tick counts', (await count()).trim() === '1/16 ready', await count())
  const stored = await page.evaluate(() => localStorage.getItem('cs602-exam-checklist'))
  record('exam checklist stored under cs602-exam-checklist', stored === '["crf-first"]', String(stored))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="exam-checklist-count"]')
  const checked = await page.isChecked('[data-strategy="crf-first"]')
  record('exam checklist tick survives reload', checked && (await count()).trim() === '1/16 ready', `${checked} ${await count()}`)

  const techRows = await page.$$eval('#techniques li', els => els.length)
  const labLinks = await page.$$eval('#techniques a[href*="lab?technique="]', els => els.map(e => e.getAttribute('href')))
  const coming = await page.$$eval('#techniques li', els => els.filter(e => e.textContent.includes('drills coming')).length)
  record('technique list shows top 12 with lab link or "drills coming"', techRows === 12 && labLinks.length + coming === 12, `rows ${techRows}, links ${labLinks.length}, coming ${coming}`)
  await page.click('#techniques button:has-text("Show all")')
  const allRows = await page.$$eval('#techniques li', els => els.length)
  record('technique list expands to all 32', allRows === 32, String(allRows))
  if (labLinks.length) record('lab link is encoded', labLinks.every(h => h.includes('%')), labLinks[0])

  const mockText = await page.textContent('#mocks')
  record('mock section renders (list or being-prepared state)', /being prepared|Start/.test(mockText), mockText.slice(0, 80))

  const paperOpen = await page.$$eval('#papers [aria-expanded="true"]', els => els.length)
  await page.click('#papers button:has-text("AY2016-17 Term 2")')
  const paperOpen2 = await page.$$eval('#papers [aria-expanded="true"]', els => els.length)
  record('past paper cards toggle', paperOpen === 1 && paperOpen2 === 2, `${paperOpen} -> ${paperOpen2}`)

  await page.click('nav[aria-label="On this page"] button:has-text("Mock exams")')
  let mocksTop = Infinity
  for (let t = 0; t < 30 && Math.abs(mocksTop) >= 80; t++) {
    await page.waitForTimeout(150)
    mocksTop = await page.evaluate(() => document.getElementById('mocks').getBoundingClientRect().top)
  }
  record('jump nav scrolls to section', Math.abs(mocksTop) < 80, `top ${Math.round(mocksTop)}px`)
  record('route unchanged after jump', page.url().endsWith('#/exam'), page.url())

  // project: checklist persistence
  await load(page, '/project', 'Group Project')
  const firstCheck = await page.getAttribute('#deliverables [data-check]', 'data-check')
  const pcount = () => page.textContent('[data-testid="checklist-count-proposal"]')
  record('project checklist starts empty', (await pcount()).trim() === '0/16', await pcount())
  await page.click(`label:has([data-check="${firstCheck}"])`)
  record('project checklist tick counts', (await pcount()).trim() === '1/16', await pcount())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="checklist-count-proposal"]')
  const pchecked = await page.isChecked(`[data-check="${firstCheck}"]`)
  const pstored = await page.evaluate(() => localStorage.getItem('cs602-project-checklist'))
  record('project checklist tick survives reload', pchecked && (await pcount()).trim() === '1/16', `${pchecked} ${pstored}`)

  // drills: answer one item in each drill
  const panel = '#drills > div:not([hidden])'
  const score = () => page.textContent(`${panel} [data-testid="drill-score"]`)
  record('drill score starts at 0/0', (await score()).includes('0/0 correct'), await score())
  const item = await page.textContent(`${panel} p.text-lg`)
  await page.click(`${panel} .grid button >> nth=1`)
  const fb = await page.textContent(`${panel} [data-testid="drill-feedback"]`)
  await (await page.$('#drills')).screenshot({ path: `${OUT}/project-desktop-drill-answered.png` })
  record('drill answer shows feedback + explanation', /^(Correct\.|Not quite)/.test(fb.trim()) && fb.length > 40, `${item} -> ${fb.slice(0, 90)}`)
  record('drill score updates', (await score()).includes('/1 correct'), await score())
  const disabled = await page.$$eval(`${panel} .grid button`, els => els.every(e => e.disabled))
  record('drill options lock after answering', disabled)
  await page.click(`${panel} button:has-text("Next item")`)
  record('drill next moves on', (await page.textContent(`${panel} p.text-lg`)) !== item)
  await page.click('#drills [role="tab"]:has-text("Which tool")')
  await page.click(`${panel} .grid button:has-text("Goal Seek")`)
  const fb2 = await page.textContent(`${panel} [data-testid="drill-feedback"]`)
  record('second drill answers independently', fb2.trim().startsWith('Correct.'), fb2.slice(0, 80))
  await page.click(`${panel} button:has-text("Reset")`)
  record('drill reset clears score', (await score()).includes('0/0 correct'), await score())
  await page.screenshot({ path: `${OUT}/project-desktop-drill-after.png` })

  const real = errors.filter(e => !isFontNoise(e))
  record('interactions: no console errors/warnings', real.length === 0, real.join(' | ') || 'clean')
  await ctx.close()
}

await browser.close()
const failed = results.filter(r => !r.ok)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
