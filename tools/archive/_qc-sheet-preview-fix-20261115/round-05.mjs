// round-05 — 巡线记录表(QC_LINE_PATROL) 打印预览：YJ_TEST 测试库，验证全幅/无滚动条
const OUT = 'C:/Users/vigna/ego/sheet-preview-fix-20261115'
const fs = await import('node:fs/promises')
const task = await taskSpace('sheet-preview-fix-20261115')
const page = task.page('p1')
async function normal() {
  try { const w = await page.cdp('Browser.getWindowForTarget', {}); if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } }); await page.waitForTimeout(300) } catch (e) {}
}
await page.goto('http://localhost:5173/#/login', { timeout: 40000 })
await page.waitForTimeout(2500)
await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4500)
const fac = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-form-item')]
  const item = items.find((x) => (x.querySelector('.el-form-item__label')?.textContent || '').includes('登录工厂'))
  const sel = item?.querySelector('.el-select'); if (!sel) return { ok: false }
  sel.scrollIntoView({ block: 'center' }); const r = sel.getBoundingClientRect()
  return { ok: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})
if (fac.ok) { await page.mouse.click(fac.x, fac.y); await page.waitForTimeout(1200) }
let opt = null
for (let i = 0; i < 12; i++) {
  opt = await page.evaluate(() => {
    const vis = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.getBoundingClientRect().width > 0)
    const hit = vis.find((x) => (x.textContent || '').includes('测试'))
    if (!hit) return { ok: false }
    const r = hit.getBoundingClientRect(); return { ok: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
  })
  if (opt.ok) break
  await page.waitForTimeout(700)
}
if (opt && opt.ok) { await page.mouse.click(opt.x, opt.y); await page.waitForTimeout(1000) }
const selected = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-form-item')]
  const item = items.find((x) => (x.querySelector('.el-form-item__label')?.textContent || '').includes('登录工厂'))
  return (item?.querySelector('.el-select')?.innerText || '').replace(/\s+/g, ' ').trim()
})
console.log('FACTORY_SELECTED=' + JSON.stringify(selected))
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(10000)
const fac2 = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mes_factory') || '{}') } catch (e) { return {} } })
console.log('IS_TEST=' + /TEST|测试/.test(JSON.stringify(fac2)))
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(6000)
await normal()
// 打开左栏第一张（测试库有 XJ-2026-11-0001/0002）
await page.evaluate(() => {
  const row = document.querySelector('.doc-select-rail tbody tr, .el-table__body-wrapper tbody tr')
  if (row) row.click()
})
await page.waitForTimeout(4000)
const st = await page.evaluate(() => ({
  sheet: !!document.querySelector('.lp-sheet'),
  editing: !!document.querySelector('.lp-sheet.is-editing'),
  rows: document.querySelectorAll('.lp-grid tbody tr').length,
  gridScroll: (() => { const g = document.querySelector('.lp-grid-scroll'); return g ? { cw: g.clientWidth, sw: g.scrollWidth } : null })(),
  sheetW: (() => { const s = document.querySelector('.lp-sheet'); return s ? { cw: s.clientWidth, sw: s.scrollWidth } : null })(),
}))
console.log('PATROL=' + JSON.stringify(st))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '导出报表')
  if (b) b.click()
})
await page.waitForTimeout(2000)
const marked = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const item = d && [...d.querySelectorAll('.efmt-item')].find((e) => txt(e).includes('打印预览'))
  if (!item) return false
  item.id = 'lp-print-preview'; return true
})
console.log('MARKED=' + marked)
if (marked) { try { await page.click('#lp-print-preview', { label: '打印预览' }) } catch (e) { console.log('CLICK_ERR=' + e.message) } await page.waitForTimeout(12000) }
const tabs = await task.tabs()
for (const t of tabs) {
  if (t.label && t.label !== page.label && (t.url || '').startsWith('blob:')) {
    try {
      const p2 = task.page(t.label)
      await p2.waitForTimeout(2000)
      const info = await p2.evaluate(async () => {
        const href = location.href
        if (!href.startsWith('blob:')) return { blob: false }
        const buf = await (await fetch(href)).arrayBuffer(); const bytes = new Uint8Array(buf)
        let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
        return { blob: true, size: bytes.length, b64: btoa(bin) }
      })
      if (info.blob) { await fs.writeFile(OUT + '/patrol-preview.pdf', Buffer.from(info.b64, 'base64')); console.log('SAVED patrol-preview.pdf ' + info.size) }
    } catch (e) { console.log('fetch fail: ' + e.message) }
  }
}
await normal()
console.log('DONE')
