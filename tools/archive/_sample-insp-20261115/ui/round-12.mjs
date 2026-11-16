/* round-12:打印态(media=print)尺寸/分页 与 English 界面走查 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115/'
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => s.name === 'sample-insp-20261115')
const task = entry.ownership === 'user' ? await claimTaskSpace(entry.id) : await taskSpace(entry.id)
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))
const log = (...a) => console.log(...a)

async function gotoCommission() {
  await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
  await page.waitForTimeout(5000)
}
async function shotLiteral(selector, file, opts = {}) {
  const r = await page.evaluate(async ([sel, sc]) => {
    const el = document.querySelector(sel)
    if (!el) return { err: 'no ' + sel }
    const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
    const w0 = Math.max(el.scrollWidth, el.offsetWidth)
    const h0 = Math.max(el.scrollHeight, el.offsetHeight)
    const url = await m.domToPng(el, { scale: sc, backgroundColor: '#ffffff', width: w0, height: h0 })
    return { url, w: w0, h: h0 }
  }, [selector, opts.scale || 1.4])
  if (r.err) { log('SHOT FAIL', r.err); return null }
  await fs.writeFile(OUT + file, Buffer.from(String(r.url).split(',')[1], 'base64'))
  log('shot', file, r.w + 'x' + r.h)
  return r
}

await gotoCommission()
/* ① 打印态 */
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(800)
const printMetrics = await page.evaluate(() => {
  const el = document.querySelector('.ic-sheet')
  const r = el?.getBoundingClientRect()
  return { w: Math.round(r?.width || 0), h: Math.round(r?.height || 0), scrollH: el?.scrollHeight || 0 }
})
log('print metrics:', JSON.stringify(printMetrics))
await shotLiteral('.ic-sheet', 'round-12-01-print-layout.png', 1.4)
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
await page.waitForTimeout(500)

/* ② English 界面 */
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload({ timeout: 60000 })
await page.waitForTimeout(6000)
const enInfo = await page.evaluate(() => {
  const sheet = document.querySelector('.ic-sheet')
  const text = (sheet?.innerText || '').replace(/\s+/g, ' ')
  const cjk = (text.match(/[\u4e00-\u9fa5]+/g) || [])
  return {
    hash: location.hash,
    hasSheet: !!sheet,
    cjkGroups: [...new Set(cjk)].slice(0, 40),
    title: (document.querySelector('.ic-title-1')?.textContent || '').trim(),
    labels: [...document.querySelectorAll('.ic-grid th')].map((th) => (th.textContent || '').trim()).slice(0, 12),
    side: [...document.querySelectorAll('.approval-side .as-side-btn')].map((e) => e.textContent.trim()).slice(0, 16),
  }
})
log('EN:', JSON.stringify(enInfo, null, 1))
await shotLiteral('.ic-sheet', 'round-12-02-english-paper.png', 1.2)
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.reload({ timeout: 60000 })
await page.waitForTimeout(4000)
log('restored locale, hash:', await page.evaluate(() => location.hash))
log('DONE')
