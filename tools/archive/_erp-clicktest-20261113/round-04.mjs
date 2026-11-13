// round-04: 修数据后重点:PI-2026-11-0013 行上缺计量单位/单价 → 弃审→补保存→审核→界面点「转ERP」。
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
const call = (p, b, f) => post('/api/px/callButton', { panelCode: p, buttonName: b, formData: f, buttonParam: {} })
const detailRows = async (panel, no) => {
  const res = await post('/api/px/queryFormDataList', { panelCode: panel, condition: {}, keyword: no, pageNo: 1, pageSize: 20 })
  for (const d of res.body?.data?.list || []) {
    const det = d?.detail && typeof d.detail === 'object' ? d.detail : {}
    for (const v of Object.values(det)) {
      if (!Array.isArray(v) || !v.length) continue
      const hit = v.filter((it) => String(it['单据编号'] || d['编号'] || '') === no)
      if (hit.length) return hit
      if (String(d['编号'] || '') === no) return v
    }
  }
  return []
}
const PI = 'PI-2026-11-0013'
const rows = await detailRows('PURCHASE_IN', PI)
console.log('ROWS ' + JSON.stringify(rows.map((it) => ({
  存货编码: it['存货编码'], 计量单位: it['计量单位'], 单价: it['单价'], 实收数量: it['实收数量'], 仓库: it['仓库'], 仓库编码: it['仓库编码'], 源单编号: it['源单编号'],
}))))
// 弃审 → 补单位/单价/仓库编码 → 审核
const un = await call('PURCHASE_IN', '弃审', { 编号: PI })
console.log('UNAUDIT ' + un.status + ' ' + JSON.stringify(un.body?.data || un.body).slice(0, 160))
const items = rows.map((it) => ({
  存货编码: it['存货编码'], 存货名称: it['存货名称'], 规格型号: it['规格型号'],
  实收数量: it['实收数量'], 计量单位: it['计量单位'] || '支', 单价: it['单价'] || 0.96,
  仓库: it['仓库'], 仓库编码: it['仓库编码'] || '', 源单编号: it['源单编号'], 采购订单行号: it['采购订单行号'],
}))
const save = await call('PURCHASE_IN', '保存', { 编号: PI, detail: { items } })
console.log('SAVE ' + save.status + ' ' + JSON.stringify(save.body?.data || save.body).slice(0, 200))
const aud = await call('PURCHASE_IN', '审核', { 编号: PI })
console.log('AUDIT ' + aud.status + ' ' + JSON.stringify(aud.body?.data || aud.body).slice(0, 160))
const rows2 = await detailRows('PURCHASE_IN', PI)
console.log('ROWS2 ' + JSON.stringify(rows2.map((it) => ({ 存货编码: it['存货编码'], 计量单位: it['计量单位'], 单价: it['单价'], 源单编号: it['源单编号'] }))))

// 界面点转ERP(边点边收消息)
await page.evaluate(() => {
  window.__msgs = []
  new MutationObserver(() => {
    document.querySelectorAll('.el-message__content').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (t && window.__msgs[window.__msgs.length - 1] !== t) window.__msgs.push(t)
    })
  }).observe(document.body, { childList: true, subtree: true })
})
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.waitForTimeout(6000)
await page.evaluate((no) => [...document.querySelectorAll('.dsr-grid tbody tr')].find((r) => (r.textContent || '').includes(no))?.click(), PI)
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const t = [...document.querySelectorAll('.tools .tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '转ERP')
  t?.querySelector('.tb-main')?.click()
})
let msgs = []
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1500)
  msgs = await page.evaluate(() => window.__msgs)
  if (msgs.length) break
}
console.log('MSGS ' + JSON.stringify(msgs))
const after = (await post('/api/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: {}, keyword: PI, pageNo: 1, pageSize: 5 })).body?.data?.list?.find((d) => String(d['编号']) === PI)
console.log('AFTER_DOC ' + JSON.stringify({ 是否已转ERP: after?.['是否已转ERP'], ERP单号: after?.['ERP单号'] }))
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-04.json',
  JSON.stringify({ rows: rows.map((it) => ({ 存货编码: it['存货编码'], 计量单位: it['计量单位'] })), msgs, after: after && { 是否已转ERP: after['是否已转ERP'], ERP单号: after['ERP单号'] } }, null, 2), 'utf8')
