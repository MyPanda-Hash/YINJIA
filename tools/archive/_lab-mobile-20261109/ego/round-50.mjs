const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 刷新后重看纸面附件条(修好宽度:100% + maxWidth=纸宽)
await page.goto('http://localhost:5173/#/panelx/list/RD_EQUIP_USE', { timeout: 30000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(9000)
const pc = await page.evaluate(() => {
  const s = document.querySelector('.rsp-attach-strip')
  const box = s ? s.getBoundingClientRect() : null
  return {
    pager: document.querySelector('.as-side-pager .page-no')?.textContent?.trim(),
    strips: document.querySelectorAll('.rsp-attach-strip').length,
    box: box ? { w: Math.round(box.width), h: Math.round(box.height), x: Math.round(box.x), y: Math.round(box.y) } : null,
    stripText: s ? (s.textContent || '').replace(/\s+/g, ' ').trim() : '',
    chips: [...document.querySelectorAll('.fac-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log(JSON.stringify(pc, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-50-pc-strip-fixed.png' })
