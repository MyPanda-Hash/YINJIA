// round-17.mjs — 补打印(取第一张单)→ 证明浏览器兜底用的是 A4《成型配料记录》纸表
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.evaluate(() => { window.print = () => console.info('[verify] print suppressed') })
const clicked = await page.evaluate(() => { const b = document.querySelectorAll('.mm-doc .el-button')[0]; if (b) { b.click(); return true } return false })
console.log('clicked first reprint =', clicked)
await page.waitForTimeout(3000)
const layer = await page.evaluate(() => {
  const html = document.body.innerHTML
  const heads = ['序号', '车间', '产品编号', '配方版本号', '物料编号', '物料名', '添加比例',
    '应投重量', '实投重量', '物料批次', '开始时间', '结束时间', '转速', '配料批次号',
    '物料水分', '配料人', '确认人']
  return {
    hasA4: /@page\{size:297mm 210mm/.test(html),
    hasTitle: html.includes('成型配料记录'),
    hasCode: html.includes('YJ-QR-147'),
    missingHeads: heads.filter((h) => !html.includes('>' + h + '<')),
    rowspans: (html.match(/rowspan="8"/g) || []).length,
    printMsg: document.querySelector('.mm-print-msg .el-alert__title')?.textContent?.trim() || '',
  }
})
console.log('browser fallback:', JSON.stringify(layer, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r17-fallback.png' })
