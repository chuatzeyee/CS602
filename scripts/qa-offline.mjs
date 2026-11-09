// Opens the single-file offline build from disk with every network request blocked (as under Examena)
// and visits each route, failing on page errors or a missing heading.
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'

const file = 'file://' + resolve('offline/CS602-Guide.html')
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/search?q=npv', '/formulas', '/formulas?q=friday%20coupon', '/bank', '/bank/q/mock-a-q2', '/topics', '/functions', '/models', '/exam', '/lab']
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
const page = await browser.newPage()
const errors = []
let blocked = 0
await page.route(/^(?!file:|data:|blob:)/, r => { blocked++; return r.abort() })
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
let failed = 0
for (const r of routes) {
  await page.goto(`${file}#${r}`)
  await page.reload()   // hash-only goto doesn't remount; reload gives each route a clean start
  const h1 = await page.locator('h1').first().textContent({ timeout: 15000 }).catch(() => null)
  const ok = h1 !== null && errors.length === 0
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r} -> ${h1 ?? '(no h1)'} ${errors.splice(0).join(' | ')}`)
}
console.log(`blocked network requests: ${blocked}`)
await browser.close()
process.exit(failed ? 1 : 0)
