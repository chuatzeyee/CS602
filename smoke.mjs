// headless smoke test for the content pages: PORT=4611 node smoke.mjs (dev server must be running)
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = process.env.PORT ?? '4602'
const BASE = `http://localhost:${PORT}/CS602/#`
const SHOTS = process.env.SHOTS ?? '/tmp/cs602_content'
const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W9', 'W10']
const NEW_WEEKS = ['W6', 'W9', 'W10']
const CONTENT_CARDS = ['Topics & Glossary', 'Practice Quiz', 'Function Bank', 'Model Walkthroughs', 'Course Map']
mkdirSync(SHOTS, { recursive: true })

// expected week colours straight from the theme tokens
const css = readFileSync(new URL('./src/index.css', import.meta.url), 'utf8')
const token = name => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
const rgb = hex => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
const hexOf = Object.fromEntries(WEEKS.map(w => [w, token(`s${w.slice(1)}`)]))
const tone = Object.fromEntries(WEEKS.map(w => [w, hexOf[w] ? rgb(hexOf[w]) : null]))

// CIE76 distance in Lab space: ~2 is a just-noticeable difference, 25+ reads as a different colour
const lab = hex => {
  const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255))
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const [x, y, z] = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883].map(f)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]))

// counts come from the data files so the checks follow the content
const data = name => {
  const src = readFileSync(new URL(`./src/data/${name}.ts`, import.meta.url), 'utf8')
  return JSON.parse(src.slice(src.indexOf('= ', src.indexOf('export const')) + 2))
}
const questions = data('quiz')
const walkthroughs = data('walkthroughs')

const results = []
async function check(name, fn) {
  try {
    await fn()
    results.push([true, name])
  } catch (e) {
    results.push([false, `${name}: ${e.message}`])
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg)
}

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('console', m => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', e => errors.push(String(e)))

// hash routes navigate in place and keep the old scroll offset, so start each page at the top
const go = async path => {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(700)
}
const shot = name => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
const clickChip = async (scope, label) => {
  await page.locator(`${scope} button`).filter({ hasText: new RegExp(`^${label}$`) }).first().click()
  await page.waitForTimeout(450)
}
const colourOf = (selector, index = 0) =>
  page.$$eval(selector, (els, i) => (els[i] ? getComputedStyle(els[i]).color : null), index)
const badge = '.space-y-3 > div > div > span.font-mono' // week tag on glossary and function cards

await check('theme defines a distinct colour for every week', () => {
  const missing = WEEKS.filter(w => !tone[w])
  expect(missing.length === 0, `missing --color-s* for ${missing}`)
  expect(new Set(Object.values(tone)).size === WEEKS.length, 'week colours are not all distinct')
  const others = { ...hexOf, glow: token('glow'), correct: token('correct'), wrong: token('wrong') }
  for (const w of NEW_WEEKS) {
    for (const [k, hex] of Object.entries(others)) {
      if (k === w) continue
      const d = deltaE(hexOf[w], hex)
      expect(d >= 25, `${w} ${hexOf[w]} too close to ${k} ${hex} (deltaE ${d.toFixed(1)})`)
    }
  }
})

// home
await go('/')
await check('home renders title, content cards and real coverage', async () => {
  expect((await page.textContent('h1')).includes('CS602 SheetSmith'), 'home title')
  const cards = await page.$$eval('a.group h2', els => els.map(e => e.textContent))
  const missing = CONTENT_CARDS.filter(c => !cards.includes(c))
  expect(missing.length === 0, `missing cards ${missing}`)
  const body = (await page.textContent('body')).replaceAll('\u2060', '')
  expect(body.includes('Weeks 1–6, 9 and 10'), 'coverage copy')
  expect(!/Weeks 1[–-]5/.test(body), 'stale "Weeks 1–5" copy')
})
await shot('home-desktop')

// topics
await go('/topics')
await check('topics lists the 8 taught weeks with their colours', async () => {
  const heads = await page.$$eval('section h2', els => els.map(e => [e.textContent, getComputedStyle(e).color]))
  const weeks = heads.map(([t]) => (t.match(/^Week (\d+)/) ?? [])[1]).map(n => `W${n}`)
  expect(JSON.stringify(weeks) === JSON.stringify(WEEKS), `sessions ${weeks}`)
  heads.forEach(([t, c], i) => expect(c === tone[WEEKS[i]], `${t.slice(0, 7)} colour ${c} != ${tone[WEEKS[i]]}`))
})
await check('topics week filter isolates W9 and cards expand', async () => {
  await clickChip('main', 'W9')
  const heads = await page.$$eval('section h2', els => els.map(e => e.textContent))
  expect(heads.length === 1 && heads[0].startsWith('Week 9'), `W9 filter shows ${heads}`)
  await page.click('section button')
  await page.waitForTimeout(200)
  expect((await page.$$('section ul li')).length > 0, 'topic card expands with points')
})
await shot('topics-w9-desktop')
await check('topics W6 and W10 filters', async () => {
  for (const w of ['W6', 'W10']) {
    await clickChip('main', w)
    const heads = await page.$$eval('section h2', els => els.map(e => e.textContent))
    expect(heads.length === 1 && heads[0].startsWith(`Week ${w.slice(1)} `), `${w} filter shows ${heads}`)
    expect((await colourOf('section h2')) === tone[w], `${w} heading colour`)
  }
})

// glossary
await go('/topics?view=glossary')
await check('glossary filters by new weeks and searches', async () => {
  const chips = await page.$$eval('main button', els => els.map(e => e.textContent.trim()))
  expect(NEW_WEEKS.every(w => chips.includes(w)), `glossary chips ${chips}`)
  await clickChip('main', 'W10')
  const badges = await page.$$eval(badge, els => els.map(e => e.textContent))
  expect(badges.length > 0 && badges.every(b => b === 'W10'), `W10 glossary badges ${[...new Set(badges)]}`)
  expect((await colourOf(badge)) === tone.W10, 'W10 badge colour')
  await shot('glossary-w10-desktop')
  await clickChip('main', 'All')
  await page.fill('input', 'Solver')
  await page.waitForTimeout(200)
  expect((await page.$$('.space-y-3 > div')).length >= 1, 'glossary search finds Solver')
})

// quiz
await go('/quiz')
await check('quiz filters to W9 and explains answers', async () => {
  const chips = await page.$$eval('main button', els => els.map(e => e.textContent.trim()))
  expect(NEW_WEEKS.every(w => chips.includes(w)), `quiz chips ${chips}`)
  await clickChip('main', 'W9')
  const counter = await page.textContent('main span.font-mono')
  const n = questions.filter(q => q.topic === 'W9').length
  expect(counter.includes(`of ${n}`) && counter.includes('W9'), `W9 counter "${counter}", want ${n} questions`)
  await page.click('.space-y-2\\.5 button')
  await page.waitForTimeout(200)
  const body = await page.textContent('body')
  expect(body.includes('Why:') && body.includes('Next question'), 'explanation and next button')
})
await shot('quiz-w9-desktop')

// functions
await go('/functions')
await check('function bank filters W10 with its colour and searches', async () => {
  await clickChip('main', 'W10')
  const badges = await page.$$eval(badge, els => els.map(e => e.textContent.trim()))
  expect(badges.length > 0 && badges.every(b => b === 'W10'), `W10 badges ${[...new Set(badges)]}`)
  expect((await colourOf(badge)) === tone.W10, 'W10 badge colour')
  await shot('functions-w10-desktop')
  await clickChip('main', 'All')
  await page.fill('input', 'VLOOKUP')
  await page.waitForTimeout(200)
  expect((await page.textContent('body')).includes('VLOOKUP'), 'search finds VLOOKUP')
})

// models
await go('/models')
await check('models: week selector, unique tabs, code blocks', async () => {
  const weekChips = await page.$$eval('[aria-label="Week"] button', els => els.map(e => e.textContent.trim()))
  expect(JSON.stringify(weekChips) === JSON.stringify(WEEKS), `week chips ${weekChips}`)
  let total = 0
  for (const w of WEEKS) {
    await clickChip('[aria-label="Week"]', w)
    const tabs = await page.$$eval('[aria-label="Walkthrough"] button', els => els.map(e => e.textContent.trim()))
    expect(tabs.length > 0 && new Set(tabs).size === tabs.length, `${w} tabs ${tabs}`)
    total += tabs.length
    const label = await page.textContent('main p.font-mono')
    expect(label.startsWith(w + ' '), `${w} label "${label}"`)
    expect((await colourOf('main p.font-mono')) === tone[w], `${w} label colour`)
  }
  expect(total === walkthroughs.length, `${walkthroughs.length} walkthroughs, got ${total}`)
  await clickChip('[aria-label="Week"]', 'W9')
  await page.locator('[aria-label="Walkthrough"] button').nth(1).click()
  await page.waitForTimeout(200)
  expect((await page.textContent('h1')).startsWith('IntroVBA'), 'second W9 tab opens IntroVBA')
  expect((await page.$$('pre')).length > 0, 'walkthrough shows code blocks')
})
await shot('models-w9-desktop')

// course
await go('/course')
await check('course map follows the outline', async () => {
  const body = await page.textContent('body')
  expect(body.includes('Assessment') && body.includes('Schedule'), 'course sections')
  const weights = await page.$$eval('section:first-of-type .font-mono', els => els.map(e => parseFloat(e.textContent)))
  expect(weights.reduce((a, b) => a + b, 0) === 100, `weights sum ${weights}`)
  const rows = await page.$$eval('section:nth-of-type(2) .w-16', els => els.map(e => [e.textContent, getComputedStyle(e).color]))
  const labels = rows.map(r => r[0])
  const want = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'Exam']
  expect(JSON.stringify(labels) === JSON.stringify(want), `schedule ${labels}`)
  for (const [w, c] of rows) if (tone[w]) expect(c === tone[w], `${w} badge colour ${c}`)
  expect(/Break Week/.test(body) && /Proposal/.test(body), 'break and proposal weeks')
})
await shot('course-desktop')
const showRow = async label => {
  await page.locator('section .w-16').filter({ hasText: new RegExp(`^${label}$`) }).first().evaluate(el => el.scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -16))
  await page.waitForTimeout(300)
}
await showRow('W6')
await shot('course-schedule-w6-exam-desktop')

// phone width: no sideways scrolling, new weeks still coloured
await page.setViewportSize({ width: 390, height: 844 })
const phone = [
  // [route, screenshot, week chip to pick, element that carries the week colour]
  ['/', 'home-390', null, null],
  ['/topics', 'topics-w6-390', 'W6', 'section h2'],
  ['/topics?view=glossary', 'glossary-w9-390', 'W9', badge],
  ['/quiz', 'quiz-w10-390', 'W10', 'main span.font-mono > span'],
  ['/functions', 'functions-w6-390', 'W6', badge],
  ['/models', 'models-w10-390', 'W10', 'main p.font-mono'],
  ['/course', 'course-390', null, null],
]
for (const [path, name, week, coloured] of phone) {
  await go(path)
  if (week) await clickChip(path === '/models' ? '[aria-label="Week"]' : 'main', week)
  await check(`390px ${name}: no horizontal overflow${week ? `, ${week} in its colour` : ''}`, async () => {
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])
    expect(sw <= cw + 1, `scrollWidth ${sw} > ${cw}`)
    if (coloured) expect((await colourOf(coloured)) === tone[week], `${week} colour on ${coloured}`)
  })
  await shot(name)
}
await go('/course')
await showRow('W1')
await shot('course-schedule-390')
await showRow('W6')
await shot('course-schedule-w6-390')
await showRow('W10')
await shot('course-schedule-w10-exam-390')

await browser.close()
await check('no console errors', () => expect(errors.length === 0, errors.join(' | ')))

for (const [ok, msg] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)
const failed = results.filter(r => !r[0]).length
console.log(failed ? `SMOKE FAIL: ${failed} of ${results.length} checks failed` : `SMOKE PASS: ${results.length} checks, screenshots in ${SHOTS}`)
process.exit(failed ? 1 : 0)
