// Builds ONE self-contained HTML file (offline/CS602-SheetSmith.html) that opens by double-click from disk:
// no server, no internet. Used for the open-book exam under Examena, which blocks the network.
import { build } from 'vite'
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'offline-dist'
process.env.VITE_OFFLINE = '1'   // reference-only build, see src/offline.ts
await build({
  base: './',
  logLevel: 'warn',
  build: {
    outDir: OUT,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,       // inline every asset as a data URL
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 100_000,
    rolldownOptions: { output: { codeSplitting: false } }, // lazy routes -> one chunk (file:// can't fetch chunks)
  },
})

const assets = join(OUT, 'assets')
let html = readFileSync(join(OUT, 'index.html'), 'utf8')
// Google Fonts can't load offline; drop them so the page falls back to system fonts at once
html = html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '')
for (const f of readdirSync(assets)) {
  const body = readFileSync(join(assets, f), 'utf8')
  if (f.endsWith('.js')) {
    const tag = new RegExp(`<script[^>]*src="\\./assets/${f.replace('.', '\\.')}"[^>]*></script>`)
    if (!tag.test(html)) throw new Error(`script tag for ${f} not found`)
    // module scripts run after parsing, so moving it to the end of <body> keeps behaviour; escape </script inside JS
    html = html.replace(tag, '').replace('</body>', () => `<script type="module">${body.replace(/<\/script/gi, '<\\/script')}</script>\n</body>`)
  } else if (f.endsWith('.css')) {
    const tag = new RegExp(`<link[^>]*href="\\./assets/${f.replace('.', '\\.')}"[^>]*>`)
    if (!tag.test(html)) throw new Error(`stylesheet tag for ${f} not found`)
    html = html.replace(tag, () => `<style>${body}</style>`)
  }
}
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('an asset was left un-inlined')
html = html.replace(/<title>[^<]*<\/title>/, '<title>CS602 Reference</title>')
// no em dashes or middle dots in the exam copy: ' — ' introduces an explanation (': '), '·' is either a separator
// (' · ' -> ', ') or multiplication in formulas like S·N(d1) ('*')
html = html
  .replace(/\\u2014|&mdash;/gi, '—').replace(/\\u00b7|&middot;/gi, '·')
  .replace(/\s+—\s+/g, ': ').replace(/—/g, '-')
  .replace(/\s+·\s+/g, ', ').replace(/·/g, '*')
if (/[—·]/.test(html)) throw new Error('em dash or middle dot left in the offline copy')
mkdirSync('offline', { recursive: true })
const target = join('offline', 'CS602-SheetSmith.html')
writeFileSync(target, html)
rmSync(OUT, { recursive: true, force: true })
console.log(`wrote ${target} (${(html.length / 1e6).toFixed(1)} MB)`)
