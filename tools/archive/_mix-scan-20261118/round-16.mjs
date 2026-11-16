// round-16.mjs — 端到端复跑(新纸面版):扫工单 → 两项扫码(带批号)→ 整单保存 → 看单据载荷 + 浏览器兜底纸面
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
// 本机没有打印站点 ⇒ 会走浏览器打印层;验收时把 window.print 打成空操作,避免弹系统对话框
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/panelx/list/MOBILE_MIX_SCAN', { timeout: 40000 })
await page.waitForTimeout(2500)
await page.evaluate(() => { window.print = () => console.info('[verify] print suppressed') })

const woInput = '.mm-scanbar input[placeholder="扫描或输入工单二维码"]'
await page.fill(woInput, '0@GD-2026-11-0015@1001')
await page.press(woInput, 'Enter')
await page.waitForTimeout(2500)

const setManual = async (v) => page.evaluate((value) => {
  const inp = document.querySelector('.mm-scale-manual input')
  if (!inp) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, String(value))
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
  return true
}, v)

const matInput = '.mm-scanbar input[placeholder^="扫描或输入物料码"]'
// 第 1 项:物料码带批号(纸面「物料批次」列就该印 20261118001)
await setManual('86.172')
await page.fill(matInput, 'YJ-TJHZ-001|20261118001')
await page.press(matInput, 'Enter')
await page.waitForTimeout(2200)
// 第 2 项
await setManual('21.042')
await page.fill(matInput, 'YJ-YKRS-005|20261118002')
await page.press(matInput, 'Enter')
await page.waitForTimeout(2200)

const beforeSave = await page.evaluate(() => ({
  prog: document.querySelector('.mm-prog')?.textContent?.trim(),
  foot: document.querySelector('.mm-foot')?.textContent?.replace(/\s+/g, ' ').trim(),
}))
await page.click('.mm-foot-btn', { label: '整单保存并打印' })
await page.waitForTimeout(4500)

const afterSave = await page.evaluate(() => ({
  toast: [...document.querySelectorAll('.el-message__content')].map((e) => e.textContent.trim()),
  printMsg: document.querySelector('.mm-print-msg .el-alert__title')?.textContent?.trim() || '',
  docs: [...document.querySelectorAll('.mm-doc')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('before:', JSON.stringify(beforeSave))
console.log('after :', JSON.stringify(afterSave, null, 2))

// 纸面载荷:新单据的 车间/产品编号/添加比例/物料批次/开始结束时间
const docNo = (afterSave.docs[0] || '').match(/PL\d+/)?.[0] || ''
const doc = await page.evaluate(async (no) => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/mix/doc?docNo=' + encodeURIComponent(no), { headers: { Authorization: 'Bearer ' + token } })
  return { status: r.status, body: await r.json().catch(() => null) }
}, docNo)
console.log('doc', docNo, ':', JSON.stringify(doc, null, 2))

// 浏览器兜底纸面:点补打印,截下打印层里的表头(证明走的是 A4 专用纸,不是领料单七列)
await page.click('.mm-doc .el-button', { label: '补打印' })
await page.waitForTimeout(3000)
const layer = await page.evaluate(() => {
  const t = document.querySelector('.print-layer, [data-print-layer], iframe')
  const html = document.body.innerHTML
  return {
    layerFound: !!t,
    hasA4: /@page\{size:297mm 210mm/.test(html),
    hasTitle: html.includes('成型配料记录'),
    hasHeads: ['序号', '车间', '产品编号', '配方版本号', '物料编号', '物料名', '添加比例',
      '应投重量', '实投重量', '物料批次', '开始时间', '结束时间', '转速', '配料批次号',
      '物料水分', '配料人', '确认人'].every((h) => html.includes('>' + h + '<')),
    printMsg: document.querySelector('.mm-print-msg .el-alert__title')?.textContent?.trim() || '',
  }
})
console.log('browser fallback:', JSON.stringify(layer, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r16-e2e-a4.png' })
