// round-17: QC_BHC 版面 + 两张新明细表页面
const task = await taskSpace('qc-8fix-20261123')
const page = await task.newPage()
const open = async (url, wait = 6000) => {
  await page.goto('http://localhost:5173/#' + url, { timeout: 60000 })
  await page.waitForTimeout(wait)
}
// ① QC_BHC 版面
await open('/panelx/list/QC_BHC')
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('BHC-2026-11-0002'))
  if (tr) tr.click()
})
await page.waitForTimeout(2500)
console.log('=== BHC ===')
console.log(JSON.stringify(await page.evaluate(() => {
  const title = document.querySelector('.as-title')
  const pairs = [...document.querySelectorAll('.q-pair')].slice(9, 12).map((p) => ({
    text: (p.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24),
    pairW: Math.round(p.getBoundingClientRect().width),
    labelW: Math.round((p.querySelector('.q-label')?.getBoundingClientRect().width) || 0),
    valW: Math.round((p.querySelector('.q-value')?.getBoundingClientRect().width) || 0),
  }))
  return {
    title: title?.innerText.trim(),
    titleW: Math.round(title?.getBoundingClientRect().width || 0),
    titleH: Math.round(title?.getBoundingClientRect().height || 0),
    titleFont: title ? getComputedStyle(title).fontSize : null,
    pairs,
    signLines: [...document.querySelectorAll('.q-signline')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim()),
  }
}), null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-17-bhc.png' })

// ② 两张明细表
for (const code of ['QC_PROC_INSP_DETAIL', 'QC_ASM_INSP_DETAIL']) {
  await open('/panelx/list/' + code, 8000)
  console.log('=== ' + code + ' ===')
  console.log(JSON.stringify(await page.evaluate(() => {
    const table = document.querySelector('.el-table')
    return {
      bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 700),
      headers: [...document.querySelectorAll('.el-table__header th')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
      rowCount: document.querySelectorAll('.el-table__body tr').length,
      firstRow: (document.querySelector('.el-table__body tr')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300),
      hasTable: !!table,
    }
  }), null, 1))
  await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-17-' + code + '.png' })
}
