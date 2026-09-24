/** Tile screenshots into one contact sheet: node contact.mjs out.png colWidth img1 img2 … */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [outPath, colW, ...imgs] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: imgs.length * (Number(colW) + 8), height: 400 } })
const cells = imgs.map((p) => `<figure><img src="data:image/png;base64,${readFileSync(p).toString('base64')}"><figcaption>${p.split('/').pop()}</figcaption></figure>`).join('')
await page.setContent(`<style>body{margin:0;display:flex;gap:8px;background:#888;font:11px sans-serif}figure{margin:0;width:${colW}px}img{width:100%;display:block}figcaption{color:#fff}</style>${cells}`)
await page.waitForTimeout(200)
await page.screenshot({ path: outPath, fullPage: true })
await browser.close()
