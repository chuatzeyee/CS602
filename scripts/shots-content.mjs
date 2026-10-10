// extra screenshots for the content pages: PORT=4611 node scripts/shots-content.mjs
import { chromium } from 'playwright-core'

const BASE = `http://localhost:${process.env.PORT ?? '4602'}/CS602/#`
const SHOTS = process.env.SHOTS ?? '/tmp/cs602_content'
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto(`${BASE}/course`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const rows = page.locator('section').nth(1).locator('.w-16')
await rows.nth(5).scrollIntoViewIfNeeded()
await page.evaluate(() => window.scrollBy(0, 300))
await page.waitForTimeout(200)
await page.screenshot({ path: `${SHOTS}/course-schedule-w6-exam-390.png` })
await page.setViewportSize({ width: 1280, height: 900 })
await page.evaluate(() => window.scrollTo(0, document.querySelectorAll('section')[1].offsetTop - 20))
await page.waitForTimeout(200)
await page.screenshot({ path: `${SHOTS}/course-schedule-desktop.png` })
// models W1 on a phone: long workbook names in the heading
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${BASE}/models`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const over = []
for (const w of ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W9', 'W10']) {
  await page.locator('[aria-label="Week"] button').filter({ hasText: new RegExp(`^${w}$`) }).click()
  const n = await page.locator('[aria-label="Walkthrough"] button').count()
  for (let i = 0; i < n; i++) {
    await page.locator('[aria-label="Walkthrough"] button').nth(i).click()
    await page.waitForTimeout(80)
    const [sw, cw, h1w] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth, document.querySelector('h1').scrollWidth - document.querySelector('h1').clientWidth])
    if (sw > cw + 1 || h1w > 1) over.push(`${w}#${i} page ${sw}/${cw} h1 overflow ${h1w}`)
    if (w === 'W1' && i === 0) await page.screenshot({ path: `${SHOTS}/models-w1-390.png` })
    if (w === 'W6' && i === 1) await page.screenshot({ path: `${SHOTS}/models-w6-part2-390.png` })
  }
}
console.log(over.length ? `overflow: ${over.join('; ')}` : 'models: no overflow at 390px')
await browser.close()
