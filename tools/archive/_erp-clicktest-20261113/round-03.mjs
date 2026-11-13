// round-03: 核实 PI-2026-11-0013 是否已转成功(ERP单号/是否已转ERP),并**边点边收**消息(ElMessage 3 秒就消失)。
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-clicktest-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const PI = 'PI-2026-11-0013'
const findDoc = async (panel, no) => {
  const r = await post('/api/px/queryFormDataList', { panelCode: panel, condition: {}, keyword: no, pageNo: 1, pageSize: 5 })
  return (r.body?.data?.list || []).find((d) => String(d['编号']) === no) || null
}
const doc = await findDoc('PURCHASE_IN', PI)
console.log('DOC ' + JSON.stringify({ no: doc?.['编号'], 状态: doc?.['单据状态'], 是否已转ERP: doc?.['是否已转ERP'], ERP单号: doc?.['ERP单号'] }))

// 装消息收集器 + XHR 探针
await page.evaluate(() => {
  window.__msgs = []
  new MutationObserver(() => {
    document.querySelectorAll('.el-message__content').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (t && window.__msgs[window.__msgs.length - 1] !== t) window.__msgs.push(t)
    })
  }).observe(document.body, { childList: true, subtree: true })
  window.__probe = []
  const open = XMLHttpRequest.prototype.open
  const send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u, ...r) { this.__u = u; return open.call(this, m, u, ...r) }
  XMLHttpRequest.prototype.send = function (b) {
    this.addEventListener('load', () => {
      try { window.__probe.push({ url: this.__u, status: this.status, body: String(this.responseText || '').slice(0, 300) }) } catch (e) { /* ignore */ }
    })
    return send.call(this, b)
  }
})

await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.waitForTimeout(6000)
await page.evaluate((no) => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  rows.find((r) => (r.textContent || '').includes(no))?.click()
}, PI)
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const t = [...document.querySelectorAll('.tools .tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '转ERP')
  t?.querySelector('.tb-main')?.click()
})
// 每 1.5s 收一次,最多 40s
for (let i = 0; i < 26; i++) {
  await page.waitForTimeout(1500)
  const st = await page.evaluate(() => ({
    msgs: window.__msgs.slice(-3),
    pushing: !!document.querySelector('.el-message--loading'),
    dialog: [...document.querySelectorAll('.el-message-box')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)),
  }))
  if (st.msgs.length || st.dialog.length) {
    console.log('T+' + ((i + 1) * 1.5) + 's ' + JSON.stringify(st))
    if (st.msgs.length && !st.dialog.length) break
  }
}
const finalMsgs = await page.evaluate(() => window.__msgs)
const probe = await page.evaluate(() => (window.__probe || []).filter((p) => /callButton|erp|kingdee/i.test(p.url || '')))
console.log('MSGS ' + JSON.stringify(finalMsgs))
console.log('PROBE ' + JSON.stringify(probe.slice(-3)))
// 再点一次会显示"已转"提示(说明第一次确实成功了);只在未转时才点
const doc2 = await findDoc('PURCHASE_IN', PI)
console.log('DOC2 ' + JSON.stringify({ 是否已转ERP: doc2?.['是否已转ERP'], ERP单号: doc2?.['ERP单号'] }))
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-03.json',
  JSON.stringify({ before: doc && { 是否已转ERP: doc['是否已转ERP'], ERP单号: doc['ERP单号'] }, msgs: finalMsgs, after: doc2 && { 是否已转ERP: doc2['是否已转ERP'], ERP单号: doc2['ERP单号'] }, probe: probe.slice(-3) }, null, 2), 'utf8')
