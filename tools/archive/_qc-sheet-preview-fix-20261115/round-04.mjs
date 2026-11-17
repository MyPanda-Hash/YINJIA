// round-01 — 首件检验单「导出报表→打印预览」：捕获新窗口 PDF，验证是否全幅/无滚动条
const OUT = 'C:/Users/vigna/ego/sheet-preview-fix-20261115-8090'
const fs = await import('node:fs/promises')
const task = await taskSpace('sheet-preview-fix-20261115-8090')
const page = task.page('p1')
async function normal() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}
async function login() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
  if (!need) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(9000)
  return true
}
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 })
await page.waitForTimeout(3000)
await login()
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 })
await page.waitForTimeout(5000)
await normal()
// 1) 打开一张草稿（左栏第一张），确保纸面在编辑态
const opened = await page.evaluate(() => {
  const rail = document.querySelector('.as-rail, .doc-rail, .react-rail, .approval-side')
  const row = rail && rail.querySelector('tbody tr')
  if (row) { row.click(); return 'rail-row' }
  const t = document.querySelector('.el-table__body-wrapper tbody tr')
  if (t) { t.click(); return 'table-row' }
  return 'none'
})
await page.waitForTimeout(4000)
const before = await page.evaluate(() => ({
  opened: document.querySelectorAll('.fi-sheet').length,
  editing: !!document.querySelector('.fi-sheet.is-editing'),
  gzY: document.querySelectorAll('.fi-sheet td.gz-y').length,
  gridScroll: (() => { const g = document.querySelector('.fi-grid-scroll'); return g ? { cw: g.clientWidth, sw: g.scrollWidth } : null })(),
  sheet: (() => { const s = document.querySelector('.fi-sheet'); return s ? { cw: s.clientWidth, sw: s.scrollWidth } : null })(),
}))
console.log('OPEN=' + opened + ' BEFORE=' + JSON.stringify(before))
// 2) 导出报表 → 打印预览
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
  item.id = 'lp-print-preview'
  return true
})
console.log('MARKED=' + marked)
if (marked) { try { await page.click('#lp-print-preview', { label: '打印预览' }) } catch (e) { console.log('CLICK_ERR=' + e.message) } await page.waitForTimeout(12000) }
const tabs = await task.tabs()
console.log('TABS=' + JSON.stringify(tabs.map((t) => ({ label: t.label, url: (t.url || '').slice(0, 50), active: t.active }))))
for (const t of tabs) {
  if (t.label && t.label !== page.label) {
    try {
      const p2 = task.page(t.label)
      await p2.waitForTimeout(2500)
      const info = await p2.evaluate(async () => {
        const href = location.href
        if (!href.startsWith('blob:')) return { href: href.slice(0, 60), blob: false }
        const buf = await (await fetch(href)).arrayBuffer()
        const bytes = new Uint8Array(buf)
        let bin = ''
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
        return { href: href.slice(0, 60), blob: true, size: bytes.length, b64: btoa(bin) }
      })
      if (info.blob) { await fs.writeFile(OUT + '/preview-8090.pdf', Buffer.from(info.b64, 'base64')) }
      console.log('NEW_WINDOW=' + t.label + ' ' + JSON.stringify({ blob: info.blob, size: info.size }))
    } catch (e) { console.log('new window fail: ' + e.message) }
  }
}
await normal()
console.log('DONE')
