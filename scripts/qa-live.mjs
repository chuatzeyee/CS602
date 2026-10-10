// smoke test of the published site: node scripts/qa-live.mjs [base-url]
import { chromium } from 'playwright-core'

const BASE = (process.argv[2] ?? 'https://chuatzeyee.github.io/CS602/').replace(/\/?$/, '/')
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('console', m => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', e => errors.push(String(e)))
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
const go = path => page.goto(`${BASE}#${path}`, { waitUntil: 'networkidle' })
const text = () => page.textContent('body')

await check('home', async () => {
  await go('/')
  if (!(await page.textContent('h1')).includes('SheetSmith')) throw new Error('no title')
})
for (const [path, want] of [['/topics', 'Week 10'], ['/quiz', 'Quiz'], ['/functions', 'Function'], ['/models', 'Model'],
  ['/course', 'Week'], ['/exam', 'Mock Exam A'], ['/project', 'Project'], ['/lab', 'Excel Lab']]) {
  await check(path, async () => {
    await go(path)
    await page.waitForFunction(w => document.body.innerText.includes(w), want, { timeout: 15000 })
  })
}
// solve one formula exercise and one VBA exercise through Reveal + Check
for (const id of ['w1-absolute-ringgit-price-list', 'w9-vba-for-next-bibs']) {
  await check(`reveal+check ${id}`, async () => {
    page.removeAllListeners('dialog')
    page.on('dialog', d => d.accept())
    await go(`/lab/${id}`)
    await page.waitForSelector('[role="grid"]', { timeout: 20000 })
    for (const b of await page.getByRole('button', { name: /^Reveal/ }).all()) {
      await b.click()
      const confirm = page.getByRole('button', { name: /^Reveal( answer| solution)?$/ }).last()
      if (await confirm.isVisible().catch(() => false)) await confirm.click()
    }
    await page.getByRole('button', { name: /^Check/ }).first().click()
    await page.waitForFunction(() => /100%|Well done|correct\. Well done/i.test(document.body.innerText), null, { timeout: 20000 })
  })
}
await check('licence files', async () => {
  for (const f of ['LICENSE.txt', 'THIRD_PARTY_LICENSES.txt']) {
    const r = await page.request.get(BASE + f)
    if (!r.ok()) throw new Error(`${f}: ${r.status()}`)
  }
})
await check('no console errors', async () => {
  if (errors.length) throw new Error(errors.slice(0, 3).join(' | '))
})
await browser.close()
console.log(failed ? `${failed} failed` : 'all passed')
process.exit(failed ? 1 : 0)
