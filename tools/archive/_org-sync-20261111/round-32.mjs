const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
// 消息弹层若已关,重新打开
let opened = await page.evaluate(() => {
  const el = document.querySelector('.nc-ref.type-msg')
  if (!el) return 'NO-ICON'
  el.click()
  return 'OPENED'
})
console.log(opened)
await page.waitForTimeout(2000)
// 点「新的待审批单据」那条消息(按内容匹配,避免误点待办)
const clicked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.nc-item')]
  const hit = items.find((el) => /新的待审批单据/.test(el.textContent || ''))
  if (!hit) return 'NO-MSG-ITEM:' + items.length
  hit.click()
  return 'MSG-CLICKED'
})
console.log(clicked)
await page.waitForTimeout(2500)
const detail = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
  return {
    title: dlg ? txt(dlg.querySelector('.el-dialog__title')) : null,
    body: dlg ? txt(dlg.querySelector('.el-dialog__body'))?.slice(0, 200) : null,
    buttons: dlg ? [...dlg.querySelectorAll('button')].map((b) => txt(b)) : null,
  }
})
console.log(JSON.stringify(detail, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-32-fm-msg-detail.png' })

// 点「去处理」→ 应跳到对应单据页面
const go = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
  if (!dlg) return 'NO-DIALOG'
  const btn = [...dlg.querySelectorAll('button')].find((b) => /去处理/.test(b.textContent || ''))
  if (!btn) return 'NO-GO-BTN'
  btn.click()
  return 'GO-CLICKED'
})
console.log(go)
await page.waitForTimeout(7000)
const after = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    hash: location.hash,
    side: (txt(document.querySelector('.approval-side')) || '').slice(0, 40),
    headVals: [...document.querySelectorAll('.qr-head-table .qr-value')].map((c) => (txt(c) || '').slice(0, 14)),
    rows: [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td.c-res')].map((c) => { const i = c.querySelector('input'); return i ? i.value : (txt(c) || '') })),
  }
})
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-32-fm-jump.png' })
