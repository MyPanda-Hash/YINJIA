const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 翻页器 ▶ :从空态翻到第一张单
const pg = await page.evaluate(() => [...document.querySelectorAll('.as-side-pager .page-btn')].map((e, i) => ({ i, txt: e.textContent.trim() })))
console.log('pager=' + JSON.stringify(pg))
await page.click('css:.as-side-pager .page-btn:nth-of-type(3)')
await page.waitForTimeout(3000)
const st = await page.evaluate(() => {
  const el = document.querySelector('.rsp-sheet')
  const inst = el?.__vueParentComponent
  const st2 = inst?.setupState || {}
  const val = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v)
  const head = inst?.props?.head || {}
  return {
    pager: document.querySelector('.as-side-pager .page-no')?.textContent?.trim(),
    headKeys: Object.keys(head).slice(0, 20),
    docNo: val(st2.sheetDocNo),
    spare: val(st2.spareAttachList)?.length ?? null,
    strips: document.querySelectorAll('.rsp-attach-strip').length,
    chips: [...document.querySelectorAll('.fac-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    bodyHasPhone: (document.body.innerText || '').includes('手机照片'),
  }
})
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-34-paged.png' })
