// round-27: 带 Bearer token 调同一接口(测试账套)—— 弃审 → 看库字段是否被清 → 重审
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.waitForTimeout(300)
const info = await page.evaluate(() => ({
  doc: (document.body.innerText.match(/单据：(CGRK-[0-9-]+)/) || [])[1],
  factory: (document.body.innerText.match(/(YINJIA-MES·测试库|YINJIA-MES)\s/) || [])[1],
  hasToken: !!localStorage.getItem('mes_token'),
}))
console.log(JSON.stringify(info))
const call = (btn) => page.evaluate(async ({ btn, doc }) => {
  const r = await fetch('/api/px/callButton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('mes_token') || '') },
    body: JSON.stringify({ panelCode: 'PURCHASE_IN', buttonName: btn, formData: { 编号: doc, 单据编号: doc }, buttonParam: {} }),
  })
  const txt = await r.text()
  return { status: r.status, body: txt.slice(0, 300) }
}, { btn, doc: info.doc })
console.log('弃审 => ' + JSON.stringify(await call('弃审')))
