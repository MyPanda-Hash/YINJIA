const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// ① 打开「审批中」的单 EU-2026-11-0001:删除行 / 清空重填 必须禁用(只有草稿能删)
const lines = await page.evaluate(() => [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('lines=' + JSON.stringify(lines))
const idx = lines.findIndex((t) => t.includes('EU-2026-11-0001'))
await page.click(`css:.labm-line >> nth=${idx}`)
await page.waitForTimeout(3500)
const st = await page.evaluate(() => ({
  doc: document.querySelector('.labm-doc')?.textContent?.trim() || '',
  delDisabled: [...document.querySelectorAll('.labm-drow-head .el-button')].map((b) => b.disabled),
  clearDisabled: (() => {
    const b = [...document.querySelectorAll('.labm-actions .el-button')].find((x) => (x.textContent || '').includes('清空'))
    return b ? b.disabled : null
  })(),
  delTitle: [...document.querySelectorAll('.labm-drow-head .el-button')].map((b) => b.getAttribute('title') || ''),
}))
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-82-nondraft.png' })

// ② 回到草稿单,展开一行点附件名:应走下载(不弹预览新窗)
const idx2 = lines.findIndex((t) => t.includes('EU-2026-11-0003'))
await page.click(`css:.labm-line >> nth=${idx2}`)
await page.waitForTimeout(3000)
await page.click('css:.labm-drow-head >> nth=0')
await page.waitForTimeout(800)
const before = (await task.pages()).length
await page.click('css:.labm-att-name >> nth=0')
await page.waitForTimeout(2500)
const after = (await task.pages()).length
console.log('pages before/after click=' + before + '/' + after)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-83-after-download.png' })
