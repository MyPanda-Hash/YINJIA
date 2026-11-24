// round-38 — 代码路径验证:把草稿暂收单某行数量改小并保存,看占用是否跟着回写
// 单据 SL-2026-11-0002(草稿) · 行 552 YJ-SX-011-5 · 原 8000 → 改成 QTY_AFTER
const BASE = 'http://127.0.0.1:8090'
const DOC = 'SL-2026-11-0002'
const LINE_ID = 552
const QTY_AFTER = 7000
const task = await taskSpace('batch link qty fix verify')
const page = task.page('p1')
await page.goto(BASE + '/#/login', { timeout: 180000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.reload({ timeout: 180000 })
await page.waitForTimeout(3000)
await page.fill('.login-form input[autocomplete="username"]', 'admin')
await page.fill('.login-form input[type="password"]', '123456')
const sel = await page.evaluate(() => {
  const el = document.querySelector('.login-form .el-select')
  return el ? el.innerText.replace(/\s+/g, ' ').trim() : ''
})
if (!sel || sel.includes('请选择')) {
  await page.click('.login-form .el-select')
  await page.waitForTimeout(600)
  await page.click('.el-select-dropdown__item')
  await page.waitForTimeout(400)
}
await page.click('.login-submit')
await page.waitForTimeout(7000)
const token = await page.evaluate(() => localStorage.getItem('mes_token'))
const H = { 'content-type': 'application/json', authorization: 'Bearer ' + token }

// ① 取单据
const r = await page.fetch(`/api/px/getFormDescriptor?panelCode=QC_RECV&code=${encodeURIComponent(DOC)}`, { headers: H, timeout: 60000 })
const fd = (JSON.parse(r.body).data) || {}
const tabs = (fd.detail && fd.detail.tabs) || []
const tabKey = (tabs[0] && tabs[0].key) || 'items'
const items = (fd.detailData && (fd.detailData[tabKey] || fd.detailData.items)) || []
const line = items.find((x) => Number(x.id) === LINE_ID)
console.log('① 取单成功: 行数=' + items.length + ' 目标行=' + JSON.stringify({ id: line && line.id, 物料: line && line['物料编码'], 数量: line && line['数量'] }))

// ② 改数量并保存(走 UI 的「保存」= callButton,内部就是我们改的 ButtonService.save)
line['数量'] = QTY_AFTER
const formData = Object.assign({}, fd.data, { 编号: fd.data['单据编号'] || DOC, detail: { items } })
const saveRes = await page.fetch('/api/px/callButton', {
  method: 'POST',
  headers: H,
  body: JSON.stringify({ panelCode: 'QC_RECV', buttonName: '保存', formData, buttonParam: {} }),
  timeout: 120000,
})
const sp = JSON.parse(saveRes.body)
console.log('② 保存返回 = ' + JSON.stringify({ status: saveRes.status, msg: sp.msg, code: sp.code, data: sp.data && Object.keys(sp.data).slice(0, 6) }))
