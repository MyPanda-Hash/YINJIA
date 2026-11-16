// round-18.mjs — 补打印时抓打印层内容(window.print 被替换成"拍照"而不是弹框)
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/panelx/list/MOBILE_MIX_SCAN', { timeout: 40000 })
await page.waitForTimeout(2500)
// 扫工单码把单据列表拉出来
await page.fill('.mm-scanbar input[placeholder="扫描或输入工单二维码"]', '0@GD-2026-11-0015@1001')
await page.press('.mm-scanbar input[placeholder="扫描或输入工单二维码"]', 'Enter')
await page.waitForTimeout(3000)
await page.evaluate(() => {
  window.__printHtml = null
  window.print = () => {
    const host = document.getElementById('yj-print-host')
    window.__printHtml = host ? host.innerHTML : ''
  }
})
const clicked = await page.evaluate(() => {
  const b = document.querySelectorAll('.mm-doc .el-button')[0]
  if (b) { b.click(); return true }
  return false
})
console.log('clicked first reprint =', clicked)
await page.waitForTimeout(3500)
const layer = await page.evaluate(() => {
  const html = window.__printHtml || ''
  const heads = ['序号', '车间', '产品编号', '配方版本号', '物料编号', '物料名', '添加比例',
    '应投重量', '实投重量', '物料批次', '开始时间', '结束时间', '转速', '配料批次号',
    '物料水分', '配料人', '确认人']
  return {
    captured: html.length,
    hasA4: /size:297mm 210mm/.test(html),
    hasTitle: html.includes('成型配料记录'),
    hasCode: html.includes('YJ-QR-147'),
    missingHeads: heads.filter((h) => !html.includes('>' + h + '<')),
    rowspans: (html.match(/rowspan="8"/g) || []).length,
    hasBatch: html.includes('20261118001'),
    hasPct: html.includes('80.37%'),
    printMsg: document.querySelector('.mm-print-msg .el-alert__title')?.textContent?.trim() || '',
  }
})
console.log('print layer:', JSON.stringify(layer, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r18-fallback.png' })
