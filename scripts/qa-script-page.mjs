// browser check for the proposal-presentation script page (/project/data-script) and its link on /project: the link
// opens the page, both slides render with their cues, timings and the Optional badge, the sources show as a table at
// 1280 px and stacked at 390 px, the Large text toggle works by mouse and keyboard and survives a reload, the tab title
// and current nav pill are right, nothing published looks like an internal file name, no sideways scroll, nothing
// left under the nav pill at the end of the page, and no console errors.
// usage: npx vite --port 4691 --strictPort, then node scripts/qa-script-page.mjs [port]
//        screenshots in /tmp/script-page/
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const PORT = process.argv[2] ?? '4691'
const ROOT = `http://localhost:${PORT}/CS602/`
const OUT = '/tmp/script-page'
const KEY = 'cs602-script-large'
const TITLE = 'Data script · CS602 SheetSmith'
const H1 = 'Proposal presentation: data portion script'
const CUES = [
  'Slide 9', 'Point to the persona box', 'Point to the 6-month and 3-month figures', 'Point to the assumptions box',
  'Slide 10', 'Gesture at the cards', 'Point to "Government support"', 'Point to "Job loss and shocks"', 'Next slide',
]
const SPOKEN_LINES = 10
const SOURCE_ROWS = 7
const LINE = 'section[aria-labelledby^="slide-"] li > p:last-child'
const TOGGLE = 'button[aria-pressed]'
mkdirSync(OUT, { recursive: true })

let failed = 0
const check = async (name, fn) => {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (e) {
    failed++
    console.log(`FAIL ${name}: ${e.message.split('\n')[0]}`)
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })

async function open(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', e => errors.push(String(e)))
  return { ctx, page, errors }
}

const settle = page => page.evaluate(() => document.getAnimations().forEach(a => a.finish()))
async function go(page, path, heading) {
  await page.goto(`${ROOT}#${path}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(h => document.querySelector('#main-content h1')?.textContent === h, heading, { timeout: 15000 })
  await settle(page)
}
const lineSize = page => page.$eval(LINE, el => parseFloat(getComputedStyle(el).fontSize))
const stored = page => page.evaluate(k => localStorage.getItem(k), KEY)
const pressed = page => page.$eval(TOGGLE, b => b.getAttribute('aria-pressed'))

// sideways scroll: the document is wider than the viewport, or an element sticks out of it without a clipping parent
const overflow = page => page.evaluate(() => {
  const vw = document.documentElement.clientWidth
  const offenders = []
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || (r.right <= vw + 1 && r.left >= -1)) continue
    let clipped = false
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') { clipped = true; break }
    }
    if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)}`)
  }
  return { extra: document.documentElement.scrollWidth - vw, offenders: offenders.slice(0, 4) }
})
const noOverflow = async page => {
  const o = await overflow(page)
  expect(o.extra <= 0 && o.offenders.length === 0, `scrolls ${o.extra}px sideways ${o.offenders.join(', ')}`)
}

// scrolled to the end, no text or control of the page sits under the fixed nav pill or the scroll-to-top button
const coveredAtEnd = page => page.evaluate(async () => {
  window.scrollTo(0, document.documentElement.scrollHeight)
  await new Promise(r => setTimeout(r, 400))
  document.getAnimations().forEach(a => a.finish())
  const fixed = [document.querySelector('nav.fixed > div'), document.querySelector('button[aria-label="Scroll to top"]')]
    .filter(el => el && getComputedStyle(el).opacity !== '0')
    .map(el => el.getBoundingClientRect())
  const content = [...document.querySelectorAll('#main-content > div *')].filter(el => {
    if (!el.checkVisibility()) return false
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || el.matches('a,button,svg')
    return own
  })
  const hits = []
  for (const el of content) {
    const r = el.getBoundingClientRect()
    if (fixed.some(f => !(r.bottom <= f.top || r.top >= f.bottom || r.right <= f.left || r.left >= f.right))) {
      hits.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}"`)
    }
  }
  const last = document.querySelector('#main-content > div').getBoundingClientRect()
  const pill = document.querySelector('nav.fixed > div').getBoundingClientRect()
  return { hits: hits.slice(0, 4), gap: Math.round(pill.top - last.bottom) }
})

const pageText = page => page.$eval('#main-content > div', el => el.innerText)
const visibleCount = (page, selector) => page.$$eval(selector, els => els.filter(e => e.checkVisibility()).length)

// ---------- 1280 px ----------
{
  const { ctx, page, errors } = await open(1280, 900)

  await check('1280 /project shows the link to the script near the top', async () => {
    await go(page, '/project', 'Group Project')
    const link = page.locator('#main-content a[href="#/project/data-script"]')
    expect(await link.count() === 1, 'one link to the script')
    expect((await link.innerText()).includes('Our proposal presentation: data portion script'), 'link text')
    const box = await link.boundingBox()
    expect(box && box.y + box.height < 900, `link is above the fold (y ${box?.y})`)
    await page.screenshot({ path: `${OUT}/project-1280.png` })
  })

  await check('1280 the link opens /#/project/data-script', async () => {
    await page.locator('#main-content a[href="#/project/data-script"]').click()
    await page.waitForFunction(h => document.querySelector('#main-content h1')?.textContent === h, H1, { timeout: 15000 })
    await settle(page)
    expect(new URL(page.url()).hash === '#/project/data-script', `url ${page.url()}`)
  })

  await check('1280 tab title, one h1, Project pill current', async () => {
    expect(await page.title() === TITLE, `title "${await page.title()}"`)
    expect(await page.locator('h1').count() === 1, 'exactly one h1')
    const current = await page.$$eval('nav[aria-label="Main"] a[aria-current="page"]', as => as.map(a => a.getAttribute('aria-label')))
    expect(current.length === 1 && current[0] === 'Project', `current pill ${current}`)
  })

  await check('1280 both slides render with titles, timings and the Optional badge on slide 9 only', async () => {
    const heads = await page.$$eval('section[aria-labelledby^="slide-"] h2', hs => hs.map(h => h.textContent))
    expect(JSON.stringify(heads) === JSON.stringify(['Slide 9: How each run is set up', 'Slide 10: Data behind the models']), `headings ${heads}`)
    const cards = await page.$$eval('section[aria-labelledby^="slide-"]', ss => ss.map(s => s.innerText))
    expect(cards[0].includes('about 45 seconds') && /\bOptional\b/i.test(cards[0]), 'slide 9 timing + Optional')
    expect(cards[1].includes('about 80 seconds') && !/\bOptional\b/i.test(cards[1]), 'slide 10 timing, no Optional')
  })

  await check('1280 the cues, in order, before their lines', async () => {
    const cues = await page.$$eval('section[aria-labelledby^="slide-"] li > p:first-child', ps =>
      ps.filter(p => p.nextElementSibling).map(p => p.textContent.replace(/^Cue: /, '')))
    expect(JSON.stringify(cues) === JSON.stringify(CUES), `cues ${JSON.stringify(cues)}`)
    expect(await page.locator(LINE).count() === SPOKEN_LINES, 'spoken line count')
    const text = await pageText(page)
    expect(text.includes('[Name] will take you through the trade-offs'), '[Name] placeholder kept')
    expect(text.includes('Every area was then re-checked in a second pass'), 'the uncued line')
  })

  await check('1280 the sources show as a table, one row per number', async () => {
    expect(await visibleCount(page, 'table tbody tr') === SOURCE_ROWS, 'visible table rows')
    expect(await visibleCount(page, 'dl > div') === 0, 'stacked list hidden')
    const heads = await page.$$eval('table th', ths => ths.map(t => t.textContent))
    expect(heads.join('|') === 'Number in the script|Source', `columns ${heads}`)
    const text = await pageText(page)
    for (const s of ['MOM Comprehensive Labour Force Survey, June 2025', 'SingStat table 17886', 'MOM levy', 'data.gov.sg (as at 9 Oct 2026)', 'NPTD NDR 2026 release', 'MOM retrenchment incidence, 2007–2025']) {
      expect(text.includes(s), `cites ${s}`)
    }
  })

  await check('1280 nothing published looks like an internal file, folder or note', async () => {
    const text = await pageText(page)
    expect(!/_/.test(text), 'snake_case name on the page')
    expect(!/\.(csv|md|txt|pdf|xlsx?|docx|pptx|json)\b/i.test(text), 'file name on the page')
    expect(!/data pack|recording/i.test(text), 'internal note on the page')
  })

  await check('1280 no sideways scroll; screenshots', async () => {
    await noOverflow(page)
    await page.screenshot({ path: `${OUT}/script-1280.png` })
    await page.screenshot({ path: `${OUT}/script-1280-full.png`, fullPage: true })
  })

  await check('1280 Large text toggles, is saved and survives a reload', async () => {
    expect(await pressed(page) === 'false', 'starts off')
    const before = await lineSize(page)
    await page.click(TOGGLE)
    const after = await lineSize(page)
    expect(await pressed(page) === 'true' && after > before, `size ${before} -> ${after}`)
    expect(await stored(page) === '1', `stored ${await stored(page)}`)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector(TOGGLE)
    await settle(page)
    expect(await pressed(page) === 'true' && await lineSize(page) === after, 'still large after reload')
    await noOverflow(page)
    await page.screenshot({ path: `${OUT}/script-1280-large.png` })
    await page.click(TOGGLE)
    expect(await pressed(page) === 'false' && await lineSize(page) === before && await stored(page) === '0', 'back to normal')
  })

  await check('1280 the toggle works from the keyboard with a visible focus ring', async () => {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.locator(TOGGLE).focus()
    await page.keyboard.press('Space')
    const ring = await page.$eval(TOGGLE, b => getComputedStyle(b).outlineStyle !== 'none' && parseFloat(getComputedStyle(b).outlineWidth) > 0)
    expect(await pressed(page) === 'true', 'Space toggles')
    expect(ring, 'focus ring visible')
    await page.keyboard.press('Enter')
    expect(await pressed(page) === 'false', 'Enter toggles back')
  })

  await check('1280 nothing left under the nav pill at the end of the page', async () => {
    const r = await coveredAtEnd(page)
    expect(r.hits.length === 0 && r.gap > 0, `covered ${r.hits.join(', ')} gap ${r.gap}`)
  })

  await check('1280 the back link returns to /project; trailing-slash URL keeps the title', async () => {
    await go(page, '/project/data-script', H1)
    await page.locator('#main-content a[href="#/project"]').click()
    await page.waitForFunction(() => document.querySelector('#main-content h1')?.textContent === 'Group Project', null, { timeout: 15000 })
    expect(await page.title() === 'Group Project · CS602 SheetSmith', `project title "${await page.title()}"`)
    await go(page, '/project/data-script/', H1)
    expect(await page.title() === TITLE, `title with trailing slash "${await page.title()}"`)
  })

  await check('1280 no console errors', async () => {
    expect(errors.length === 0, errors.slice(0, 3).join(' | '))
  })
  await ctx.close()
}

// ---------- 390 px ----------
{
  const { ctx, page, errors } = await open(390, 844)

  await check('390 /project link fits and opens the script', async () => {
    await go(page, '/project', 'Group Project')
    await noOverflow(page)
    await page.screenshot({ path: `${OUT}/project-390.png` })
    await page.locator('#main-content a[href="#/project/data-script"]').click()
    await page.waitForFunction(h => document.querySelector('#main-content h1')?.textContent === h, H1, { timeout: 15000 })
    await settle(page)
    expect(await page.title() === TITLE, `title "${await page.title()}"`)
  })

  await check('390 the sources stack (no table), one entry per number', async () => {
    expect(await visibleCount(page, 'dl > div') === SOURCE_ROWS, 'visible stacked entries')
    expect(await visibleCount(page, 'table') === 0, 'table hidden')
  })

  await check('390 no sideways scroll; screenshots', async () => {
    await noOverflow(page)
    await page.screenshot({ path: `${OUT}/script-390.png` })
    await page.screenshot({ path: `${OUT}/script-390-full.png`, fullPage: true })
  })

  await check('390 nothing left under the nav pill at the end of the page', async () => {
    const r = await coveredAtEnd(page)
    expect(r.hits.length === 0 && r.gap > 0, `covered ${r.hits.join(', ')} gap ${r.gap}`)
  })

  await check('390 Large text: bigger lines, no sideways scroll, kept after reload', async () => {
    await page.evaluate(() => window.scrollTo(0, 0))
    const before = await lineSize(page)
    await page.click(TOGGLE)
    const after = await lineSize(page)
    expect(after > before, `size ${before} -> ${after}`)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector(TOGGLE)
    await settle(page)
    expect(await pressed(page) === 'true' && await lineSize(page) === after, 'still large after reload')
    await noOverflow(page)
    await page.screenshot({ path: `${OUT}/script-390-large.png` })
    await page.screenshot({ path: `${OUT}/script-390-large-full.png`, fullPage: true })
    const r = await coveredAtEnd(page)
    expect(r.hits.length === 0 && r.gap > 0, `covered at the end ${r.hits.join(', ')}`)
    await page.evaluate(k => localStorage.removeItem(k), KEY)
  })

  await check('390 no console errors', async () => {
    expect(errors.length === 0, errors.slice(0, 3).join(' | '))
  })
  await ctx.close()
}

// ---------- 320 px: the narrowest width the nav pill is built for ----------
{
  const { ctx, page, errors } = await open(320, 640)
  await check('320 no sideways scroll with normal or large text', async () => {
    await go(page, '/project/data-script', H1)
    await noOverflow(page)
    await page.click(TOGGLE)
    await settle(page)
    expect(await pressed(page) === 'true', 'toggle pressed')
    await noOverflow(page)
    await page.screenshot({ path: `${OUT}/script-320-large.png` })
    await page.evaluate(k => localStorage.removeItem(k), KEY)
    expect(errors.length === 0, errors.slice(0, 3).join(' | '))
  })
  await ctx.close()
}

await browser.close()
console.log(failed ? `${failed} failed` : 'all passed')
process.exit(failed ? 1 : 0)
