const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')

// ① 手机端列表 + 模糊查询
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(4500)
const before = await page.evaluate(() => ({
  lines: [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  total: document.querySelector('.labm-sec-num')?.textContent?.trim(),
}))
console.log('list=' + JSON.stringify(before, null, 2))

await page.fill('css:.labm-row input', '拍照联调')
await page.waitForTimeout(300)
await page.click('css:.labm-row .el-button')
await page.waitForTimeout(2500)
const after = await page.evaluate(() => ({
  lines: [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  total: document.querySelector('.labm-sec-num')?.textContent?.trim(),
}))
console.log('fuzzy="拍照联调" => ' + JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-48-mobile-search.png' })

// ② 电脑端同一个面板:应自动带出最新一张单(带照片的那张),纸面上方出现「手机照片」附件条
await page.goto('http://localhost:5173/#/panelx/list/RD_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(9000)
const pc = await page.evaluate(() => {
  const el = document.querySelector('.rsp-sheet')
  const inst = el?.__vueParentComponent
  const st2 = inst?.setupState || {}
  const val = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v)
  const head = inst?.props?.head || {}
  return {
    pager: document.querySelector('.as-side-pager .page-no')?.textContent?.trim(),
    headDoc: head['单据编号'] || head['编号'] || '',
    sheetDocNo: val(st2.sheetDocNo),
    spare: val(st2.spareAttachList)?.length ?? null,
    strips: document.querySelectorAll('.rsp-attach-strip').length,
    stripText: [...document.querySelectorAll('.rsp-attach-strip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    chips: [...document.querySelectorAll('.fac-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log('pc=' + JSON.stringify(pc, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-49-pc-strip.png' })
