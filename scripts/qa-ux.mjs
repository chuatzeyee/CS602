// UX + accessibility pass for the non-lab pages (Home, Topics/Glossary, Quiz, Functions, Models, Course, Exam,
// Project) and the shared NavPill / ScrollToTop. Screenshots at 1280, 768 and 390 px (360 and 320 px for the nav fit
// and reflow checks), then per page: computed contrast of every visible text run against its composited background,
// heading outline and h1 count, landmarks, unnamed controls, aria-label on generic elements, horizontal overflow,
// the bottom nav pill (fit, labels, current page), line length, document title, console errors; at 1280 px a Tab
// walk (visible focus, focus hidden under the fixed nav) and the keyboard flows (accordions, tabs, drills, quiz,
// checklist, search + Esc, jump nav, scroll-to-top).
// usage: npx vite --port 4661 --strictPort, then node scripts/qa-ux.mjs [port] [label]
//        screenshots + report.json in /tmp/cs602_ux/<label>/
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = process.argv[2] ?? '4661'
const LABEL = process.argv[3] ?? 'run'
const ROOT = `http://localhost:${PORT}/CS602`
const OUT = `/tmp/cs602_ux/${LABEL}`
mkdirSync(OUT, { recursive: true })

const PAGES = [
  ['home', '/#/'],
  ['topics', '/#/topics'],
  ['glossary', '/#/topics?view=glossary'],
  ['quiz', '/#/quiz'],
  ['functions', '/#/functions'],
  ['models', '/#/models'],
  ['course', '/#/course'],
  ['exam', '/#/exam'],
  ['project', '/#/project'],
]
const WIDTHS = [
  { w: 1280, h: 900, mobile: false, shots: true },
  { w: 768, h: 1024, mobile: false, shots: true },
  { w: 390, h: 844, mobile: true, shots: true },
  { w: 360, h: 740, mobile: true, shots: false },
  { w: 320, h: 640, mobile: true, shots: false },
]

const report = { pages: {}, flows: {}, focus: {}, console: [] }
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })

async function open({ w, h, mobile }, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, ...opts })
  const page = await ctx.newPage()
  page.on('pageerror', e => report.console.push(`${w}px pageerror ${page.url()}: ${String(e).slice(0, 300)}`))
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') report.console.push(`${w}px ${m.type()} ${page.url()}: ${m.text().slice(0, 300)}`)
  })
  return page
}

// every route lives in one document (HashRouter): load each page fresh so focus and scroll state never carry over
async function fresh(page, path) {
  await page.goto('about:blank')
  await page.goto(ROOT + path)
  await settle(page)
}

async function settle(page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish() } catch { /* infinite */ } }))
  await page.waitForTimeout(100)
}

// ---------- in-page audit (self-contained: serialised into the page) ----------
function audit() {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })
  const cache = new Map()
  const rgba = css => {
    if (cache.has(css)) return cache.get(css)
    cx.clearRect(0, 0, 1, 1)
    cx.fillStyle = 'rgba(0,0,0,0)'
    cx.fillStyle = css
    cx.fillRect(0, 0, 1, 1)
    const d = cx.getImageData(0, 0, 1, 1).data
    const v = [d[0], d[1], d[2], d[3] / 255]
    cache.set(css, v)
    return v
  }
  const over = (top, bottom) => [0, 1, 2].map(i => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1)
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
  const desc = el => {
    const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 4).join('.')
    const txt = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50)
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`
  }
  const VOID = [13, 13, 13, 1]

  function background(el) {
    const layers = []
    let opacity = 1
    let image = false
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      opacity *= Number(cs.opacity)
      if (cs.backgroundImage !== 'none') image = true
      const c = rgba(cs.backgroundColor)
      if (c[3] > 0) {
        layers.push(c)
        if (c[3] >= 0.999) break
      }
    }
    let base = VOID
    if (layers.length && layers[layers.length - 1][3] >= 0.999) base = layers.pop()
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base)
    return { bg: base, opacity, image }
  }

  // ---- contrast of every visible text run ----
  const pairs = new Map()
  const failures = []
  const exempt = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  while (walker.nextNode()) {
    const t = walker.currentNode
    if (!t.textContent.trim()) continue
    const el = t.parentElement
    if (!el || seen.has(el) || el.closest('script,style,noscript')) continue
    seen.add(el)
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
    const range = document.createRange()
    range.selectNodeContents(t)
    const rr = range.getBoundingClientRect()
    if (rr.width < 2 || rr.height < 2) continue
    const cs = getComputedStyle(el)
    const { bg, opacity, image } = background(el)
    const fg0 = rgba(cs.color)
    const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * opacity], bg)
    const r = ratio(fg, bg)
    const size = parseFloat(cs.fontSize)
    const weight = Number(cs.fontWeight)
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const need = large ? 3 : 4.5
    const text = t.textContent.trim().replace(/\s+/g, ' ').slice(0, 60)
    const disabled = Boolean(el.closest('button:disabled,[aria-disabled="true"],fieldset:disabled'))
    const key = `${hex(fg0)}${fg0[3] < 1 ? '/' + fg0[3].toFixed(2) : ''}${opacity < 1 ? ' op' + opacity.toFixed(2) : ''} on ${hex(bg)}`
    const entry = pairs.get(key) ?? { key, fg: hex(fg), bg: hex(bg), ratio: r, count: 0, samples: [], large, image }
    entry.count++
    if (entry.samples.length < 3) entry.samples.push(`${text} [${desc(el).slice(0, 70)}]`)
    pairs.set(key, entry)
    const item = { ratio: Number(r.toFixed(2)), need, fg: hex(fg), bg: hex(bg), size, weight, text, el: desc(el).slice(0, 90), ariaHidden: Boolean(el.closest('[aria-hidden="true"]')) }
    if (r < need) (disabled ? exempt : failures).push(item)
  }
  // placeholder text
  const placeholders = [...document.querySelectorAll('input[placeholder],textarea[placeholder]')].map(i => {
    const ph = rgba(getComputedStyle(i, '::placeholder').color)
    const { bg } = background(i)
    return { placeholder: i.getAttribute('placeholder'), ratio: Number(ratio(over(ph, bg), bg).toFixed(2)) }
  })

  // ---- headings ----
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter(h => h.checkVisibility())
    .map(h => ({ level: Number(h.tagName[1]), text: h.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) }))
  const skips = []
  headings.forEach((h, i) => { if (i > 0 && h.level > headings[i - 1].level + 1) skips.push(`h${headings[i - 1].level} -> h${h.level} "${h.text}"`) })
  if (headings[0] && headings[0].level !== 1) skips.unshift(`first heading is h${headings[0].level} "${headings[0].text}"`)

  // ---- landmarks ----
  const landmarks = {
    main: document.querySelectorAll('main,[role=main]').length,
    nav: [...document.querySelectorAll('nav,[role=navigation]')].map(n => n.getAttribute('aria-label') ?? '(unlabelled)'),
    regions: [...document.querySelectorAll('section[aria-label],section[aria-labelledby],[role=region]')].length,
  }

  // ---- names ----
  const nameOf = el => {
    const lb = el.getAttribute('aria-labelledby')
    if (lb) return lb.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ').trim()
    const al = el.getAttribute('aria-label')
    if (al && al.trim()) return al.trim()
    if (el.labels && el.labels.length) return [...el.labels].map(l => l.textContent).join(' ').trim()
    const txt = [...el.childNodes].map(n => {
      if (n.nodeType === 3) return n.textContent
      if (n.nodeType !== 1 || n.getAttribute('aria-hidden') === 'true') return ''
      if (n.tagName === 'IMG') return n.getAttribute('alt') ?? ''
      return n.textContent
    }).join('').trim()
    if (txt) return txt
    return (el.getAttribute('title') ?? el.getAttribute('placeholder') ?? '').trim()
  }
  const controls = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=link]')]
  const unnamed = controls.filter(c => !nameOf(c)).map(desc)
  const placeholderOnly = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]),textarea')]
    .filter(i => !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby') && !(i.labels && i.labels.length)).map(desc)
  const genericLabelled = [...document.querySelectorAll('div[aria-label]:not([role]),span[aria-label]:not([role]),p[aria-label]:not([role])')].map(desc)
  const imgNoAlt = [...document.querySelectorAll('img:not([alt])')].map(desc)
  const progressNoName = [...document.querySelectorAll('[role=progressbar]')].filter(p => !nameOf(p)).length
  const tabs = [...document.querySelectorAll('[role=tab]')].map(t => ({ name: nameOf(t), controls: t.getAttribute('aria-controls'), tabindex: t.getAttribute('tabindex') }))
  const tabpanels = document.querySelectorAll('[role=tabpanel]').length
  const accordions = [...document.querySelectorAll('main button')].filter(b => b.querySelector('svg.lucide-chevron-down')).map(b => ({ name: nameOf(b).slice(0, 40), expanded: b.getAttribute('aria-expanded'), inHeading: Boolean(b.closest('h1,h2,h3,h4,h5,h6')) }))
  const positiveTabindex = [...document.querySelectorAll('[tabindex]')].filter(e => Number(e.getAttribute('tabindex')) > 0).map(desc)
  const ids = [...document.querySelectorAll('[id]')].map(e => e.id)
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i)

  // ---- overflow ----
  const vw = document.documentElement.clientWidth
  const offenders = []
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || (r.right <= vw + 1 && r.left >= -1)) continue
    let clipped = false
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') { clipped = true; break }
    }
    if (!clipped && offenders.length < 6) offenders.push(`${desc(el).slice(0, 80)} [${Math.round(r.left)}..${Math.round(r.right)}]`)
  }
  const overflow = { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw, offenders }

  // ---- nav pill ----
  const navEl = document.querySelector('nav.fixed')
  const pill = navEl?.firstElementChild
  let nav = null
  if (pill) {
    const r = pill.getBoundingClientRect()
    const links = [...pill.querySelectorAll('a')].map(a => {
      const lr = a.getBoundingClientRect()
      const span = a.querySelector('span')
      return { name: nameOf(a), w: Math.round(lr.width), h: Math.round(lr.height), current: a.getAttribute('aria-current'), labelShown: Boolean(span && span.checkVisibility()) }
    })
    nav = {
      label: navEl.getAttribute('aria-label'), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
      top: Math.round(r.top), bottom: Math.round(r.bottom), vw, fits: r.left >= 0 && r.right <= vw && pill.scrollWidth <= pill.clientWidth + 1,
      items: links.length, current: links.filter(l => l.current === 'page').map(l => l.name), labelsShown: links.filter(l => l.labelShown).length,
      minTarget: Math.min(...links.map(l => Math.min(l.w, l.h))),
    }
  }

  // ---- line length (characters per line of long text blocks) ----
  const lines = []
  for (const el of seen) {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()
    if (own.length < 140 || !el.checkVisibility()) continue
    const cs = getComputedStyle(el)
    cx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const avg = cx.measureText(own).width / own.length
    const r = el.getBoundingClientRect()
    const width = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    lines.push({ cpl: Math.round(width / avg), size: cs.fontSize, el: desc(el).slice(0, 80) })
  }
  lines.sort((a, b) => b.cpl - a.cpl)

  return {
    title: document.title, h1: headings.filter(h => h.level === 1).map(h => h.text), headings: headings.length, skips, landmarks,
    unnamed, placeholderOnly, genericLabelled, imgNoAlt, progressNoName, tabs, tabpanels, accordions, positiveTabindex, duplicateIds,
    overflow, nav, placeholders,
    contrast: { failures: failures.sort((a, b) => a.ratio - b.ratio), exempt: exempt.length, pairs: [...pairs.values()].sort((a, b) => a.ratio - b.ratio).map(p => ({ ...p, ratio: Number(p.ratio.toFixed(2)) })) },
    lineLength: { max: lines[0]?.cpl ?? 0, over90: lines.filter(l => l.cpl > 90).slice(0, 6), median: lines[Math.floor(lines.length / 2)]?.cpl ?? 0, blocks: lines.length },
  }
}

// ---------- pages × widths ----------
for (const size of WIDTHS) {
  const page = await open(size)
  for (const [name, path] of PAGES) {
    await fresh(page, path)
    if (name === 'home') await page.waitForTimeout(700) // lazy counts
    const a = await page.evaluate(audit)
    if (name === 'home') {
      a.homeCards = await page.evaluate(() => [...document.querySelectorAll('main a[href^="#/"] h2')].map(h => {
        const card = h.closest('a')
        return { title: h.textContent, badges: [...card.querySelectorAll('span.font-mono')].map(s => s.textContent) }
      }))
    }
    report.pages[`${name}@${size.w}`] = a
    if (size.shots) {
      await page.screenshot({ path: `${OUT}/${name}-${size.w}.png` })
      await page.screenshot({ path: `${OUT}/${name}-${size.w}-full.png`, fullPage: true })
    } else if (name === 'home' || name === 'exam') {
      await page.screenshot({ path: `${OUT}/${name}-${size.w}.png` })
    }
  }
  await page.context().close()
}

// ---------- keyboard: Tab walk with focus visibility (1280 and 390) ----------
async function focusInfo(page) {
  return page.evaluate(() => {
    document.getAnimations().forEach(a => { try { a.finish() } catch { /* infinite */ } })
    const el = document.activeElement
    if (!el || el === document.body) return { tag: 'body' }
    const styleOf = e => { const s = getComputedStyle(e); return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor].join('|') }
    const host = el.closest('label') ?? el
    const focused = styleOf(el) + styleOf(host)
    const cs = getComputedStyle(el)
    const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}` : ''
    const r = host.getBoundingClientRect()
    const pill = document.querySelector('nav.fixed > div')
    const p = pill?.getBoundingClientRect()
    const inNav = Boolean(el.closest('nav.fixed'))
    const overlap = p && !inNav && !(r.bottom <= p.top || r.top >= p.bottom || r.right <= p.left || r.left >= p.right)
    const underNav = overlap ? Math.round(Math.min(r.bottom, p.bottom) - Math.max(r.top, p.top)) : 0
    el.blur()
    const blurred = styleOf(el) + styleOf(host)
    el.focus()
    const txt = (el.getAttribute('aria-label') ?? el.textContent ?? el.getAttribute('placeholder') ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
    return { tag: el.tagName.toLowerCase(), txt, outline, changed: focused !== blurred, underNav, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }
  })
}

for (const size of [WIDTHS[0], WIDTHS[2]]) {
  const page = await open(size)
  for (const [name, path] of PAGES) {
    await fresh(page, path)
    const walk = []
    for (let k = 0; k < 70; k++) {
      await page.keyboard.press('Tab')
      const f = await focusInfo(page)
      walk.push(f)
      if (f.tag === 'body' && k > 2) break
    }
    report.focus[`${name}@${size.w}`] = {
      stops: walk.length,
      noIndicator: walk.filter(f => f.tag !== 'body' && !f.changed).map(f => `${f.tag} "${f.txt}"`),
      underNav: walk.filter(f => f.underNav > 0).map(f => `${f.tag} "${f.txt}" ${f.underNav}px of ${f.bottom - f.top}px under nav`),
      navReachedAt: walk.findIndex(f => f.txt === 'Home'),
      outlines: [...new Set(walk.map(f => f.outline || '(none: style change only)'))].slice(0, 5),
    }
    if (size.w === 1280 && ['topics', 'exam', 'project'].includes(name)) {
      // a mid-walk focus state, for the screenshots
      await fresh(page, path)
      for (let k = 0; k < 6; k++) await page.keyboard.press('Tab')
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${OUT}/focus-${name}-1280.png` })
    }
  }
  await page.context().close()
}

// ---------- keyboard flows (1280) ----------
{
  const page = await open(WIDTHS[0])
  const flows = report.flows
  const active = () => page.evaluate(() => {
    const el = document.activeElement
    return el ? `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}"` : 'none'
  })

  // Topics accordion
  await fresh(page, '/#/topics')
  const acc = page.locator('main section button').first()
  await acc.focus()
  const accBefore = await acc.getAttribute('aria-expanded')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const openAfterEnter = await page.locator('main section').first().locator('h4').count()
  const accAfter = await acc.getAttribute('aria-expanded')
  await page.screenshot({ path: `${OUT}/flow-topics-accordion-1280.png` })
  await page.keyboard.press(' ')
  await page.waitForTimeout(150)
  const openAfterSpace = await page.locator('main section').first().locator('h4').count()
  flows.topicsAccordion = { ariaExpandedBefore: accBefore, ariaExpandedAfter: accAfter, sectionsShownAfterEnter: openAfterEnter, sectionsShownAfterSpace: openAfterSpace }

  // Topics/Glossary view toggle state
  const toggles = await page.evaluate(() => [...document.querySelectorAll('main button')].filter(b => /^(Topics|Glossary)/.test(b.textContent.trim())).map(b => `${b.textContent.trim()} pressed=${b.getAttribute('aria-pressed')} current=${b.getAttribute('aria-current')}`))
  flows.topicsViewToggle = toggles

  // Glossary search + Esc + empty state
  await fresh(page, '/#/topics?view=glossary')
  const search = page.locator('main input').first()
  await search.focus()
  await page.keyboard.type('zzqxv')
  await page.waitForTimeout(150)
  const empty = await page.getByText('No terms match your search.').isVisible()
  const status = await page.evaluate(() => [...document.querySelectorAll('[role=status],[aria-live]')].map(e => e.textContent.trim().slice(0, 60)))
  await page.screenshot({ path: `${OUT}/flow-glossary-empty-1280.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  const afterEsc = await search.inputValue()
  const termsAfterEsc = await page.locator('main h2, main h3').count()
  flows.glossarySearch = { emptyStateShown: empty, liveRegions: status, valueAfterEsc: afterEsc, termsAfterEsc, inputType: await search.getAttribute('type') }

  // Functions search Esc
  await fresh(page, '/#/functions')
  const fsearch = page.locator('main input').first()
  await fsearch.focus()
  await page.keyboard.type('zzqxv')
  await page.waitForTimeout(100)
  const fEmpty = await page.getByText('No functions match your search.').isVisible()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  flows.functionsSearch = { emptyStateShown: fEmpty, valueAfterEsc: await fsearch.inputValue() }

  // Quiz by keyboard
  await fresh(page, '/#/quiz')
  const firstOpt = page.locator('main button:has(span.font-mono)').first()
  await firstOpt.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  const afterPick = await active()
  const feedback = await page.evaluate(() => {
    const live = [...document.querySelectorAll('[aria-live],[role=status]')].map(e => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 80))
    return { live }
  })
  await page.screenshot({ path: `${OUT}/flow-quiz-answered-1280.png` })
  await page.keyboard.press('Tab')
  const tabAfterPick = await active()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  const afterNext = await active()
  await page.keyboard.press('Tab')
  const tabAfterNext = await active()
  flows.quiz = { focusAfterPick: afterPick, tabAfterPick, focusAfterNext: afterNext, tabAfterNext, ...feedback }

  // Exam: paper accordion, show-all, checklist, jump nav
  await fresh(page, '/#/exam')
  const paperBtns = page.locator('#papers button[aria-expanded]')
  const second = paperBtns.nth(1)
  await second.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const paperExpanded = await second.getAttribute('aria-expanded')
  const showAll = page.locator('#techniques button', { hasText: /Show (all|the top)/ })
  const rowsBefore = await page.locator('#techniques li').count()
  await showAll.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const rowsAfter = await page.locator('#techniques li').count()
  const showAllExpanded = await showAll.getAttribute('aria-expanded')
  const box = page.locator('#strategy input[type=checkbox]').first()
  await box.focus()
  await page.keyboard.press(' ')
  await page.waitForTimeout(100)
  const countAfter = await page.getByTestId('exam-checklist-count').textContent()
  await page.screenshot({ path: `${OUT}/flow-exam-checklist-focus-1280.png` })
  await page.keyboard.press(' ')
  await page.waitForTimeout(100)
  const countAfter2 = await page.getByTestId('exam-checklist-count').textContent()
  await fresh(page, '/#/exam')
  const jumpBtn = page.locator('nav[aria-label="On this page"] button', { hasText: 'Strategy' })
  await jumpBtn.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  const jumpTop = await page.evaluate(() => Math.round(document.getElementById('strategy').getBoundingClientRect().top))
  const jumpFocus = await active()
  await page.keyboard.press('Tab')
  const jumpTab = await active()
  flows.exam = { paperExpanded, techniqueRows: `${rowsBefore} -> ${rowsAfter}`, showAllExpanded, checklistCount: `${countAfter} -> ${countAfter2}`, jumpSectionTop: jumpTop, focusAfterJump: jumpFocus, tabAfterJump: jumpTab }

  // Exam: scroll to top by keyboard
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(500)
  const stt = page.getByRole('button', { name: 'Scroll to top' })
  await stt.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  flows.scrollToTop = { scrollY: await page.evaluate(() => Math.round(scrollY)), focusAfter: await active(), ariaHiddenFocused: await page.evaluate(() => Boolean(document.activeElement?.closest('[aria-hidden="true"]'))) }

  // Project: drill tabs + drill answer by keyboard
  await fresh(page, '/#/project')
  const tab0 = page.getByRole('tab').first()
  await tab0.focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(100)
  const selected = await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].map(t => `${t.textContent.trim().slice(0, 24)}=${t.getAttribute('aria-selected')}`))
  const tabFocus = await active()
  await page.keyboard.press('Home')
  await page.waitForTimeout(100)
  const homeFocus = await active()
  await page.locator('#drills').scrollIntoViewIfNeeded()
  const opt = page.locator('#drills div:not([hidden]) > div > div.grid button').first()
  await opt.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  const drillAfterPick = await active()
  await page.keyboard.press('Tab')
  const drillTab = await active()
  await page.screenshot({ path: `${OUT}/flow-project-drill-1280.png` })
  const live = await page.evaluate(() => [...document.querySelectorAll('#drills [aria-live],#drills [role=status]')].map(e => e.textContent.trim().slice(0, 60)))
  // deliverable checklist + collapsible
  const coll = page.locator('#conventions button[aria-expanded]').first()
  await coll.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  flows.project = { tabsAfterArrowRight: selected, focusAfterArrowRight: tabFocus, focusAfterHome: homeFocus, drillFocusAfterPick: drillAfterPick, drillTabAfterPick: drillTab, drillLive: live, conventionExpanded: await coll.getAttribute('aria-expanded') }

  // focus handoffs: quiz/drill feedback, then the next question/item
  await fresh(page, '/#/quiz')
  await page.locator('main .space-y-2\\.5 button').first().focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  flows.quizHandoff = { afterPick: await active() }
  await page.keyboard.press('Tab')
  flows.quizHandoff.tab = await active()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  flows.quizHandoff.afterNext = await active()
  await page.keyboard.press('Tab')
  flows.quizHandoff.tabAfterNext = await active()

  // nav pill by keyboard: focus lands on the new page's heading (eager and lazy routes), titles per route
  const navTo = async label => {
    await page.locator(`nav[aria-label="Main"] a[aria-label="${label}"]`).focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)
    return { focus: await active(), title: await page.title() }
  }
  await fresh(page, '/#/')
  flows.navKeyboard = { quiz: await navTo('Quiz'), project: await navTo('Project'), lab: await navTo('Excel Lab'), home: await navTo('Home') }
  await page.locator('nav[aria-label="Main"] a[aria-label="Topics"]').click()
  await page.waitForTimeout(600)
  flows.navMouse = { focus: await active(), title: await page.title() }

  // focus gallery: one control of each kind, keyboard-focused, transition settled
  const gallery = [
    ['/#/topics', 'main section h3 button', 'accordion'],
    ['/#/topics?view=glossary', 'main input', 'search'],
    ['/#/exam', 'nav[aria-label="On this page"] button', 'jumpnav'],
    ['/#/exam', '#strategy input[type=checkbox]', 'checklist'],
    ['/#/project', '[role=tab]', 'drilltab'],
    ['/#/quiz', 'nav[aria-label="Main"] a[aria-label="Functions"]', 'navpill'],
  ]
  for (const [path, selector, label] of gallery) {
    await fresh(page, path)
    await page.keyboard.press('Tab') // keyboard modality, so script focus counts as :focus-visible
    await page.locator(selector).first().focus()
    await page.locator(selector).first().evaluate(el => (el.closest('label') ?? el).scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(350)
    await page.screenshot({ path: `${OUT}/focusring-${label}-1280.png` })
  }

  // reduced motion: are animations/transitions neutralised?
  await page.context().close()
  const rm = await open(WIDTHS[0], { reducedMotion: 'reduce' })
  await rm.goto(ROOT + '/#/')
  await rm.waitForLoadState('networkidle')
  flows.reducedMotion = await rm.evaluate(() => {
    const card = document.querySelector('main a[href^="#/"]')
    const cs = getComputedStyle(card)
    return { animationDuration: cs.animationDuration, transitionDuration: cs.transitionDuration, scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior }
  })
  await rm.context().close()
}

await browser.close()
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))

// ---------- summary ----------
const lines = []
for (const [key, a] of Object.entries(report.pages)) {
  const worst = a.contrast.failures.slice(0, 3).map(f => `${f.ratio}:1 ${f.fg} on ${f.bg} "${f.text.slice(0, 24)}"`).join('; ')
  lines.push(`${key.padEnd(16)} title="${a.title}" h1=${a.h1.length} skips=${a.skips.length} overflowX=${a.overflow.scrollWidth - a.overflow.clientWidth}${a.overflow.offenders.length ? ' [' + a.overflow.offenders[0] + ']' : ''} ` +
    `nav=${a.nav ? `${a.nav.fits ? 'fits' : 'OVERFLOWS'} ${a.nav.left}..${a.nav.right}/${a.nav.vw} labels=${a.nav.labelsShown} current=${a.nav.current.join(',') || '-'} minTarget=${a.nav.minTarget}` : 'missing'} ` +
    `contrastFail=${a.contrast.failures.length} unnamed=${a.unnamed.length} genericLabel=${a.genericLabelled.length} cpl=${a.lineLength.max}` + (worst ? `\n    worst: ${worst}` : ''))
}
console.log(lines.join('\n'))
console.log('\nFOCUS', JSON.stringify(report.focus, null, 1).slice(0, 6000))
console.log('\nFLOWS', JSON.stringify(report.flows, null, 1))
console.log('\nCONSOLE', report.console.length ? report.console.join('\n') : 'none')
