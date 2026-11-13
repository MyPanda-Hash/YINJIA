const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
const dlg0 = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null)
  return d ? { text: (d.textContent || '').replace(/\s+/g, ' ').slice(0, 90), buttons: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim()) } : null
})
console.log('dialog now=' + JSON.stringify(dlg0))
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return
  const inp = d.querySelector('textarea')
  if (inp) {
    const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    s.call(inp, '尺寸实测 437.9/438.0 超出 436±0.5，请复检后重新提交')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
  }
})
await page.waitForTimeout(700)
console.log('confirm=' + await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return 'NO-DIALOG'
  const btn = [...d.querySelectorAll('button')].find((b) => /确认驳回/.test(b.textContent || ''))
  if (!btn) return 'NO-CONFIRM:' + [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).join('/')
  if (btn.disabled) return 'DISABLED'
  btn.click()
  return 'CLICKED'
}))
const msgs = []
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log('msgs=' + JSON.stringify([...new Set(msgs)]))
console.log(JSON.stringify(await page.evaluate(() => {
  const el = document.querySelector('.approval-side')
  return { side: el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) : '' }
})))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-39-rejected.png' })
