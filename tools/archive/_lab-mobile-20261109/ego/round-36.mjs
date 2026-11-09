const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 整页刷新后再直开面板(keep-alive 里上一次 HMR 打断的实例会残留 0/0)
await page.goto('http://localhost:5173/#/panelx/list/RD_EQUIP_USE', { timeout: 30000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(9000)
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
    stripText: [...document.querySelectorAll('.rsp-attach-strip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    chips: [...document.querySelectorAll('.fac-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    bodyHasPhone: (document.body.innerText || '').includes('手机照片'),
  }
})
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-36-reload.png' })
