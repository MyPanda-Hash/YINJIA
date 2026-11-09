// round-26: 服务端闭环核对(测试账套)—— 已转单据「弃审」是否清掉 是否已转ERP/ERP单号,重审后仍为"否"
// 只在登录态页面里调同一接口(不是 curl 假点 UI):弃审 → 重审,不推金蝶。
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.waitForTimeout(300)
const doc = await page.evaluate(() => (document.body.innerText.match(/单据：(CGRK-[0-9-]+)/) || [])[1])
const factory = await page.evaluate(() => (document.body.innerText.match(/(YINJIA-MES·测试库|YINJIA-MES)\s/) || [])[1])
console.log('doc=' + doc + ' factory=' + factory)
const call = (btn) => page.evaluate(async ({ btn, doc }) => {
  const r = await fetch('/api/px/callButton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ panelCode: 'PURCHASE_IN', buttonName: btn, formData: { 编号: doc, 单据编号: doc }, buttonParam: {} }),
  })
  let j = null
  try { j = await r.json() } catch { j = { parseFail: true } }
  return { status: r.status, body: j }
}, { btn, doc })
const un = await call('弃审')
console.log('弃审 => ' + JSON.stringify(un).slice(0, 400))
await page.waitForTimeout(1500)
const re = await call('审核')
console.log('审核 => ' + JSON.stringify(re).slice(0, 400))
