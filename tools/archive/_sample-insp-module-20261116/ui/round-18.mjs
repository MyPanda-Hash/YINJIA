/* round-18:放大视口 → 真实点保存(已带入 2 行明细、已填三行合并值) */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-module-20261116/'
const task = await taskSpace(1)
const page = (await task.pages())[0]
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.waitForTimeout(800)
const st = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '保存')
  const r = b?.getBoundingClientRect()
  return { vw: innerWidth, btn: r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }, items: document.querySelectorAll('.ic-items tbody tr').length }
})
console.log('state:', JSON.stringify(st))
try { await page.click('.approval-side .as-side-btn:text-is("保存")', { label: 'click save' }); console.log('save clicked') } catch (e) { console.log('save click fail: ' + e.message) }
await page.waitForTimeout(6000)
const out = await page.evaluate(() => ({
  toasts: [...document.querySelectorAll('.el-message')].map((e) => e.textContent.trim()),
  boxes: [...document.querySelectorAll('.el-message-box')].filter((e) => e.offsetWidth).map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 160)),
  status: (document.querySelector('.approval-side')?.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
  docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(),
}))
console.log('after save:', JSON.stringify(out, null, 2))
async function shotPaper(file, scale = 1.3) {
  const url = await page.evaluate(async (sc) => {
    const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
    const el = document.querySelector('.ic-sheet')
    const w0 = Math.max(el.scrollWidth, el.offsetWidth)
    const h0 = Math.max(el.scrollHeight, el.offsetHeight)
    return await m.domToPng(el, { scale: sc, backgroundColor: '#ffffff', width: w0, height: h0 })
  }, scale)
  if (url.err) { console.log('SHOT FAIL', url.err); return }
  await fs.writeFile(OUT + file, Buffer.from(String(url).split(',')[1], 'base64'))
  console.log('shot', file)
}
await shotPaper('round-18-saved.png')
