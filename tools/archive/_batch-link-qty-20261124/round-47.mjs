// round-47 — 生产对账(键统一):订单号/行号/物料 归一后再比,分三类
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('qc rec detail index link prod2')
const page = task.page('p1')
const t0 = Date.now()

await page.goto(BASE + '/#/dashboard', { timeout: 180000 })
await page.waitForTimeout(3000)
let tk = await page.evaluate(() => localStorage.getItem('mes_token'))
if (!tk) {
  await page.goto(BASE + '/#/login', { timeout: 180000 })
  await page.waitForSelector('.login-form input[autocomplete="username"]', { timeout: 60000 })
  await page.fill('.login-form input[autocomplete="username"]', 'admin')
  await page.fill('.login-form input[type="password"]', '123456')
  await page.click('.login-form .el-select')
  await page.waitForTimeout(800)
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('.el-select-dropdown__item')]
      .find((e) => { const x = e.innerText.trim(); return x && !x.includes('测试') && x.includes('YINJIA') })
    if (t) t.click()
  })
  await page.waitForTimeout(600)
  await page.click('.login-submit')
  await page.waitForTimeout(9000)
}
const token = await page.evaluate(() => localStorage.getItem('mes_token'))
const H = { 'content-type': 'application/json', authorization: 'Bearer ' + token }
console.log('登录 OK token=' + !!token)

async function post(url, body) {
  const r = await page.fetch(url, { method: 'POST', headers: H, body: JSON.stringify(body), timeout: 120000 })
  if (r.status !== 200) throw new Error(url + ' status=' + r.status)
  const p = JSON.parse(r.body)
  return p.data || p
}
async function get(url) {
  const r = await page.fetch(url, { headers: H, timeout: 120000 })
  if (r.status !== 200) throw new Error(url + ' status=' + r.status)
  const p = JSON.parse(r.body)
  return p.data || p
}
const normOrder = (v) => String(v == null ? '' : v).trim().toUpperCase()
const normLine = (v) => {
  const s = String(v == null ? '' : v).trim()
  const n = Number(s)
  return Number.isFinite(n) ? String(Math.round(n * 1e4) / 1e4) : s
}
const normMat = (v) => String(v == null ? '' : v).trim().toUpperCase()
const keyOf = (o, l, m) => normOrder(o) + '#' + normLine(l) + '#' + normMat(m)
const splitOrders = (s) => String(s || '').split(/[、,，;；\/\s]+/).map((x) => x.trim()).filter(Boolean)

let docs = []
for (let p = 1; p <= 20; p++) {
  const d = await post('/api/px/queryFormDataList', { panelCode: 'QC_RECV', condition: {}, pageNo: p, pageSize: 200 })
  docs = docs.concat(d.list || [])
  if (docs.length >= (d.totalSize || 0) || (d.list || []).length === 0) { console.log('暂收单 ' + d.totalSize + ' 张,已取 ' + docs.length); break }
}

const actual = new Map()
let noOrderLine = 0
for (const d of docs) {
  const no = d['单据编号'] || d['编号']
  let fd
  try { fd = await get(`/api/px/getFormDescriptor?panelCode=QC_RECV&code=${encodeURIComponent(no)}`) } catch (e) { continue }
  const head = fd.data || {}
  const heads = splitOrders(head['采购订单号'])
  const tabs = (fd.detail && fd.detail.tabs) || []
  const items = (fd.detailData && (fd.detailData[(tabs[0] && tabs[0].key) || 'items'] || fd.detailData.items)) || []
  for (const it of items) {
    const lineOrders = splitOrders(it['采购单号'])
    const orders = lineOrders.length ? lineOrders : (heads.length === 1 ? heads : [])
    if (!orders.length) { noOrderLine++; continue }
    const k = keyOf(orders[0], it['采购订单行号'], it['物料编码'])
    const qty = Number(it['数量'] || 0)
    actual.set(k, (actual.get(k) || 0) + qty)
  }
}
console.log('明细汇总:键 ' + actual.size + ' 个;无订单号行 ' + noOrderLine + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + 's)')

const orders = [...new Set([...actual.keys()].map((k) => k.split('#')[0]))]
const over = [], under = [], nolink = []
for (const order of orders) {
  let lines = []
  try { lines = ((await post('/api/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: order })).lines) || [] } catch (e) { continue }
  for (const l of lines) {
    const k = keyOf(order, l['行号'], l['物料编码'])
    const sent = Number(l['已送数量'] || 0)
    const act = actual.get(k) || 0
    const diff = sent - act
    if (Math.abs(diff) <= 0.00005) continue
    const rec = { 订单: order, 行号: normLine(l['行号']), 物料: l['物料编码'], 已送: sent, 暂收: act, 差: diff }
    if (sent === 0) nolink.push(rec)
    else if (diff > 0) over.push(rec)
    else under.push(rec)
  }
}
const fmt = (r) => `${r.订单} 行${r.行号} ${r.物料}: 已送 ${r.已送} / 暂收 ${r.暂收} (差 ${r.差})`
over.sort((a, b) => Math.abs(b.差) - Math.abs(a.差))
under.sort((a, b) => Math.abs(b.差) - Math.abs(a.差))
nolink.sort((a, b) => Math.abs(b.暂收) - Math.abs(a.暂收))
console.log('\n【A】占用多于单据(已送>暂收) = ' + over.length + '；合计差额 ' + over.reduce((s, r) => s + r.差, 0))
over.slice(0, 12).forEach((r) => console.log('  ' + fmt(r)))
console.log('\n【B】占用少于单据(已送<暂收) = ' + under.length + '；合计差额 ' + under.reduce((s, r) => s + r.差, 0))
under.slice(0, 12).forEach((r) => console.log('  ' + fmt(r)))
console.log('\n【C】已送=0 但有暂收(无占用链) = ' + nolink.length)
nolink.slice(0, 8).forEach((r) => console.log('  ' + fmt(r)))
console.log('\n耗时 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's')
