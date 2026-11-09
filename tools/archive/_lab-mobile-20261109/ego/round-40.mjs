const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.click('css:.el-select-dropdown li:nth-child(3)')   // 加标测试系统3# = 手机端存的那台
await page.waitForTimeout(3500)
const st = await page.evaluate(() => {
  const el = document.querySelector('.rsp-sheet')
  const inst = el?.__vueParentComponent
  const st2 = inst?.setupState || {}
  const val = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v)
  const head = inst?.props?.head || {}
  return {
    pager: document.querySelector('.as-side-pager .page-no')?.textContent?.trim(),
    headKeys: Object.keys(head).slice(0, 12),
    docNo: val(st2.sheetDocNo),
    spare: val(st2.spareAttachList)?.length ?? null,
    strips: document.querySelectorAll('.rsp-attach-strip').length,
    stripText: [...document.querySelectorAll('.rsp-attach-strip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    chips: [...document.querySelectorAll('.fac-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-40-picked-device.png' })
