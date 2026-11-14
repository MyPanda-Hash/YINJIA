const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.evaluate(() => { const el = document.querySelector('.nc-ref.type-msg'); if (el) el.click() })
await page.waitForTimeout(2000)
console.log('click=' + await page.evaluate(() => {
  const hit = [...document.querySelectorAll('.nc-item')].find((el) => (el.textContent || '').includes('JYSJ-2026-11-0004'))
  if (!hit) return 'NOT-FOUND'
  hit.click(); return 'OK'
}))
await page.waitForTimeout(2500)
console.log('detail=' + JSON.stringify(await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return d ? (d.querySelector('.el-dialog__body')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 180) : null
})))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-41-zfy-reject-detail.png' })
console.log('go=' + await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const b = d && [...d.querySelectorAll('button')].find((x) => /去处理/.test(x.textContent || ''))
  if (!b) return 'NO-BTN'
  b.click(); return 'OK'
}))
await page.waitForTimeout(7000)
console.log('jump=' + JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    hash: location.hash,
    side: (txt(document.querySelector('.approval-side')) || '').slice(0, 34),
    rows: [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td.c-res')].map((c) => { const i = c.querySelector('input'); return i ? i.value : (txt(c) || '') })),
  }
}), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-41-zfy-jump-reject.png' })
