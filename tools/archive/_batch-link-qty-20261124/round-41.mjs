// round-41 — 验证:改暂收单数量保存后,分批送料(生单)那边 已送/剩余/可送上限 是否同步
// 对象:订单 YJ-20261110-03 ↔ 草稿暂收单 SL-2026-11-0002 行 552(YJ-SX-011-5,现 8000)
const BASE = 'http://127.0.0.1:8090'
const DOC = 'SL-2026-11-0002'
const ORDER = 'YJ-20261110-03'
const LINE_ID = 552
const MAT = 'YJ-SX-011-5'
const task = await taskSpace('batch link qty fix verify')
const page = task.page('p1')

async function token() { return await page.evaluate(() => localStorage.getItem('mes_token')) }
async function ensureLogin() {
  if ((await token())) return
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
}
/** 生单(分批送料)接口里这条订单行的数量口径 */
async function sendLines() {
  const t = await token()
  const r = await page.fetch('/api/px/batchFlow/lines', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t },
    body: JSON.stringify({ sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: ORDER }),
    timeout: 60000,
  })
  const d = JSON.parse(r.body).data || {}
  const hit = (d.lines || []).filter((x) => String(x['物料编码'] || '').trim() === MAT)
  return hit.map((x) => ({
    物料: x['物料编码'], 订单数量: x['数量'], 已送: x['已送数量'], 已退回: x['已退回数量'],
    剩余: x['剩余数量'], 可送上限: x['可送上限'],
  }))
}
/** 把暂收单某行数量改成 qty 并保存 */
async function setQty(qty) {
  const t = await token()
  const H = { 'content-type': 'application/json', authorization: 'Bearer ' + t }
  const r0 = await page.fetch(`/api/px/getFormDescriptor?panelCode=QC_RECV&code=${encodeURIComponent(DOC)}`, { headers: H, timeout: 60000 })
  const fd = JSON.parse(r0.body).data || {}
  const tabs = (fd.detail && fd.detail.tabs) || []
  const key = (tabs[0] && tabs[0].key) || 'items'
  const items = (fd.detailData && (fd.detailData[key] || fd.detailData.items)) || []
  const line = items.find((x) => Number(x.id) === LINE_ID)
  if (!line) throw new Error('找不到行 ' + LINE_ID)
  line['数量'] = qty
  const formData = Object.assign({}, fd.data, { 编号: fd.data['单据编号'] || DOC, detail: { items } })
  const r1 = await page.fetch('/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'QC_RECV', buttonName: '保存', formData, buttonParam: {} }),
    timeout: 120000,
  })
  return r1.status
}

await ensureLogin()
console.log('① 改前 · 生单侧 = ' + JSON.stringify(await sendLines()))
console.log('   保存(6000) 状态 = ' + await setQty(6000))
console.log('② 改成 6000 后 · 生单侧 = ' + JSON.stringify(await sendLines()))
console.log('   复原(8000) 状态 = ' + await setQty(8000))
console.log('③ 复原后 · 生单侧 = ' + JSON.stringify(await sendLines()))
