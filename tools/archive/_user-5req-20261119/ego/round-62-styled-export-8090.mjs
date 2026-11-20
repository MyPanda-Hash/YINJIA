const fs = await import('node:fs/promises')
const task = await taskSpace('plan-board-20261119')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/WO_REPORT_LIST', { timeout: 30000 })
await page.waitForTimeout(4000)
if (await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))) {
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
  await page.waitForTimeout(4500)
  await page.goto('http://127.0.0.1:8090/#/panelx/list/WO_REPORT_LIST', { timeout: 30000 })
  await page.waitForTimeout(4000)
}
console.log('hash', await page.evaluate(() => location.hash))
await page.evaluate(() => {
  window.__blobs = []
  const orig = URL.createObjectURL
  URL.createObjectURL = function (b) {
    if (b instanceof Blob) window.__blobs.push(b)
    return orig.call(URL, b)
  }
})
await page.click('.report-table tbody .el-checkbox >> nth=0', { label: 'select row 1' })
await page.click('.report-table tbody .el-checkbox >> nth=3', { label: 'select row 4' })
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tools .tb-main')].find((x) => x.textContent.includes('导出报表'))
  if (el) el.click()
})
await page.waitForTimeout(600)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.el-dialog .efmt-item')].find((x) => x.innerText.includes('勾选行'))
  if (el) el.click()
})
await page.waitForTimeout(3000)
const bytes = await page.evaluate(async () => {
  const b = window.__blobs[window.__blobs.length - 1]
  if (!b) return null
  const ab = await b.arrayBuffer()
  return { size: ab.byteLength, data: Array.from(new Uint8Array(ab)) }
})
if (!bytes) { console.log('NO BLOB'); process.exit(1) }
await fs.writeFile('D:/workspace/yinjia/_scratch/ego-plan-board-20261119/export-styled-8090.xlsx', Buffer.from(bytes.data))
console.log(JSON.stringify({ size: bytes.size, msg: await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => m.innerText.trim())) }))
