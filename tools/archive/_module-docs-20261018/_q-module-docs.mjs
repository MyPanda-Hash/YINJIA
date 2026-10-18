#!/usr/bin/env node
/**
 * 探针:桌面五模块「单据入口」接口取证(2026-10-18)
 *
 * 用途:核对 GET /api/dashboard/module-docs?module=<rd|prod|stock|sales|quality>&limit=7
 *   - 每个模块返回的面板数
 *   - 最新单据条数(必须 = limit,且按 asp_time1 倒序)
 *   - 抽样打印前 3 条(单号 / 面板 / 制单人 / 时间)
 *
 * 用法(仓库根):
 *   node tools/archive/_module-docs-20261018/_q-module-docs.mjs
 *   node tools/archive/_module-docs-20261018/_q-module-docs.mjs http://127.0.0.1:8091
 *
 * 默认打 8090(正式实例),第二个参数可换端口 —— 验新接口时常用 8091 起一份临时实例,
 * 免得为了看一个接口把用户正在用的 8090 停掉重打包。
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const USER = process.env.YINJIA_UI_USER || 'admin'
const PASS = process.env.YINJIA_UI_PASS || '123456'

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: t }
}
async function get(path, token) {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: t }
}

const lg = await post('/api/auth/login', { userName: USER, password: PASS })
if (!lg.json?.data?.token) {
  console.log('[FAIL] 登录失败', lg.status, lg.text.slice(0, 200))
  process.exit(1)
}
const token = lg.json.data.token
console.log('[OK] 登录', USER, '@', BASE)

let bad = 0
for (const mod of ['rd', 'prod', 'stock', 'sales', 'quality']) {
  const r = await get('/api/dashboard/module-docs?module=' + mod + '&limit=7', token)
  if (r.status !== 200 || !r.json?.data) {
    console.log(`[FAIL] ${mod} HTTP ${r.status} ${r.text.slice(0, 160)}`)
    bad++
    continue
  }
  const d = r.json.data
  const docs = d.docs || []
  const panels = d.panels || []
  const desc = docs.every((x, i) => i === 0 || String(docs[i - 1].at) >= String(x.at))
  const ok = docs.length <= 7 && desc
  if (!ok) bad++
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${mod}: ${panels.length} 个单据面板, ${docs.length} 张单据, 倒序=${desc}`)
  console.log('      面板:', panels.map((p) => p.code).join(' '))
  for (const x of docs.slice(0, 3)) {
    console.log(`      ${String(x.at).slice(0, 16)}  ${x.panelName}  ${x.docNo}  ${x.creator || '-'}`)
  }
}
console.log(bad === 0 ? '[PASS] 五模块单据入口全部符合预期' : `[FAIL] ${bad} 个模块不符合预期`)
process.exit(bad === 0 ? 0 : 2)
