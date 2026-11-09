// round-07: 改后回归 —— 已转单据点「转ERP」应弹"已转过"警告,而不是「执行成功」
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(7000)

await page.evaluate(() => {
  window.__erpReqs = []
  window.__toasts = []
  const open = XMLHttpRequest.prototype.open
  const send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__m = m; this.__u = u; return open.call(this, m, u, ...rest) }
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      if (String(this.__u || '').includes('callButton')) {
        window.__erpReqs.push({ url: String(this.__u), status: this.status, body: (() => { try { return JSON.parse(this.responseText) } catch { return null } })() })
      }
    })
    return send.apply(this, args)
  }
  // 记录所有出现过的 toast(它们 2~3 秒后消失,别等到最后才读)
  const seen = new Set()
  window.__toastPoll = setInterval(() => {
    for (const el of document.querySelectorAll('.el-message')) {
      const t = (el.textContent || '').trim()
      const cls = String(el.className || '')
      if (t && !seen.has(t + '|' + cls)) { seen.add(t + '|' + cls); window.__toasts.push({ text: t, cls }) }
    }
  }, 100)
})

const docNo = await page.evaluate(() => (document.body.innerText.match(/单据：(CGRK-[0-9-]+)/) || [])[1])
console.log('doc=' + docNo)
const clicked = await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => (s.textContent || '').trim() === '转ERP')
  if (!main) return 'no-main'
  main.click()
  return 'clicked'
})
console.log('click=' + clicked)
await page.waitForTimeout(4000)
console.log('RESP=' + JSON.stringify((await page.evaluate(() => window.__erpReqs))[0]?.body?.data || null))
console.log('TOASTS=' + JSON.stringify(await page.evaluate(() => window.__toasts), null, 2))
console.log('rowStillPushed=' + JSON.stringify(await page.evaluate(() => {
  const row = [...document.querySelectorAll('tr')].find((tr) => (tr.innerText || '').includes((document.body.innerText.match(/单据：(CGRK-[0-9-]+)/) || [])[1] || '###'))
  return row ? row.innerText.replace(/\s+/g, ' ').slice(0, 200) : '(row not found)'
})))
