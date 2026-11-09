// round-28: 重审 → 界面点「转ERP」→ 这次应当真的推送成功(测试账套 → 金蝶沙箱)
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.waitForTimeout(300)
const doc = await page.evaluate(() => (document.body.innerText.match(/单据：(CGRK-[0-9-]+)/) || [])[1])
// ① 重新审核
const re = await page.evaluate(async ({ doc }) => {
  const r = await fetch('/api/px/callButton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('mes_token') || '') },
    body: JSON.stringify({ panelCode: 'PURCHASE_IN', buttonName: '审核', formData: { 编号: doc, 单据编号: doc }, buttonParam: {} }),
  })
  return { status: r.status, body: (await r.text()).slice(0, 300) }
}, { doc })
console.log('审核 => ' + JSON.stringify(re))
// ② 刷新页面后点界面上的「转ERP」(真点击)
await page.goto('http://127.0.0.1:8090/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(8000)
await page.evaluate(() => {
  window.__reqs = []; window.__toasts = []
  const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u, ...r) { this.__u = u; return open.call(this, m, u, ...r) }
  XMLHttpRequest.prototype.send = function (...a) {
    this.addEventListener('load', () => {
      if (String(this.__u || '').includes('callButton')) window.__reqs.push((() => { try { return JSON.parse(this.responseText) } catch { return null } })())
    })
    return send.apply(this, a)
  }
  setInterval(() => {
    for (const el of document.querySelectorAll('.el-message')) {
      const t = (el.textContent || '').trim()
      if (t && !window.__toasts.includes(t)) window.__toasts.push(t)
    }
  }, 100)
})
const clicked = await page.evaluate(() => {
  const m = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '转ERP')
  if (!m) return 'none'
  m.click(); return 'clicked'
})
console.log('click=' + clicked + ' doc=' + await page.evaluate(() => (document.body.innerText.match(/单据：(CGRK-[0-9-]+)/) || [])[1]))
await page.waitForTimeout(15000)
console.log('RESP=' + JSON.stringify(await page.evaluate(() => window.__reqs)))
console.log('TOASTS=' + JSON.stringify(await page.evaluate(() => window.__toasts)))
