// round-48 — 生产真错单判定:已送 > 该订单该物料的**全部**暂收量 ⇒ 必然错(与客户那张同类)
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('qc rec detail index link prod2')
const page = task.page('p1')
const t0 = Date.now()

await page.goto(BASE + '/#/dashboard', { timeout: 180000 })
await page.waitForTimeout(3000)
if (!(await page.evaluate(() => localStorage.getItem('mes_token')))) {
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

async function post(url, body) {
  const r = await page.fetch(url, { method: 'POST', headers: H, body: JSON.stringify(body), timeout: 120000 })
  if (r.status !== 200) throw new Error(url + ' ' + r.status)
  const p = JSON.parse(r.body)
  return p.data || p
}
async function get(url) {
  const r = await page.fetch(url, { headers: H, timeout: 120000 })
  if (r.status !== 200) throw new Error(url + ' ' + r.status)
  const p = JSON.parse(r.body)
  return p.data || p
}
const up = (v) => String(v == null ? '' : v).trim().toUpperCase()
const lineNo = (v) => { const s = String(v == null ? '' : v).trim(); const n = Number(s); return Number.isFinite(n) ? String(Math.round(n * 1e4) / 1e4) : s }
const splitOrders = (s) => String(s || '').split(/[、,，;；\/\s]+/).map((x) => x.trim()).filter(Boolean)

let docs = []
for (let p = 1; p <= 20; p++) {
  const d = await post('/api/px/queryFormDataList', { panelCode: 'QC_RECV', condition: {}, pageNo: p, pageSize: 200 })
  docs = docs.concat(d.list || [])
  if (docs.length >= (d.totalSize || 0) || (d.list || []).length === 0) { console.log('暂收单 ' + d.totalSize + ' 张'); break }
}

const exact = new Map()   // 订单#行号#物料
const byMat = new Map()   // 订单#物料(上界:同订单同物料的全部暂收)
for (const d of docs) {
  const no = d['单据编号'] || d['编号']
  let fd
  try { fd = await get(`/api/px/getFormDescriptor?panelCode=QC_RECV&code=${encodeURIComponent(no)}`) } catch (e) { continue }
  const head = fd.data || {}
  const heads = splitOrders(head['采购订单号'])
  const tabs = (fd.detail && fd.detail.tabs) || []
  const items = (fd.detailData && (fd.detailData[(tabs[0] && tabs[0].key) || 'items'] || fd.detailData.items)) || []
  for (const it of items) {
    const lo = splitOrders(it['采购单号'])
    const orders = lo.length ? lo : (heads.length === 1 ? heads : [])
    if (!orders.length) continue
    const o = up(orders[0]); const m = up(it['物料编码']); const q = Number(it['数量'] || 0)
    const ke = `${o}#${lineNo(it['采购订单行号'])}#${m}`
    exact.set(ke, (exact.get(ke) || 0) + q)
    byMat.set(`${o}#${m}`, (byMat.get(`${o}#${m}`) || 0) + q)
  }
}
console.log('汇总完成:精确键 ' + exact.size + ' / 订单物料 ' + byMat.size + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + 's)')

const orders = [...new Set([...exact.keys()].map((k) => k.split('#')[0]))]
const real = [], ambiguous = [], under = []
for (const order of orders) {
  let lines = []
  try { lines = ((await post('/api/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: order })).lines) || [] } catch (e) { continue }
  for (const l of lines) {
    const sent = Number(l['已送数量'] || 0)
    const m = up(l['物料编码']); const ln = lineNo(l['行号'])
    const ex = exact.get(`${order}#${ln}#${m}`) || 0
    const ub = byMat.get(`${order}#${m}`) || 0
    if (Math.abs(sent - ex) <= 0.00005) continue
    const rec = { 订单: order, 行号: ln, 物料: l['物料编码'], 已送: sent, 同键暂收: ex, 同物料暂收: ub, 差: sent - ex }
    if (sent > ub + 0.00005) real.push(rec)          // 超过该订单该物料的全部暂收 ⇒ 必然错
    else if (sent > ex + 0.00005) ambiguous.push(rec) // 部分暂收可能无链
    else under.push(rec)                             // 占用少于已暂收
  }
}
const f = (r) => `${r.订单} 行${r.行号} ${r.物料}: 已送 ${r.已送} / 同键暂收 ${r.同键暂收} / 同物料暂收 ${r.同物料暂收}`
real.sort((a, b) => Math.abs(b.差) - Math.abs(a.差))
console.log('\n【真错·占用超过全部暂收】' + real.length + ' 行；合计多算 ' + real.reduce((s, r) => s + r.差, 0))
real.forEach((r) => console.log('  ' + f(r)))
console.log('\n【可疑·同一订单同物料还有未走占用链的暂收】' + ambiguous.length + ' 行')
ambiguous.slice(0, 10).forEach((r) => console.log('  ' + f(r)))
console.log('\n【占用少于已暂收(额度被低估)】' + under.length + ' 行；合计 ' + under.reduce((s, r) => s + r.差, 0))
under.slice(0, 10).forEach((r) => console.log('  ' + f(r)))
console.log('\n耗时 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's')
