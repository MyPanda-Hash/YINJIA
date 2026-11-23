// round-01: 打开出货检验（功能）列表,看是否有带「内部批次」的草稿单
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (acc && pwd) {
    setVal(acc, 'admin'); setVal(pwd, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  }
})
await page.waitForTimeout(5000)
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(7000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 2500),
  rows: [...document.querySelectorAll('.el-table__body tr')].slice(0, 12).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim()),
  docRows: [...document.querySelectorAll('.doc-dir-item, .dd-row, .el-table__row')].length,
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-01.png', fullPage: false })
