/**
 * 生产退料端到端验证(测试账套):审核生产领料单 → 扫料 → 按批次退料 → 核对退料单号与拆行。
 * 用法:node _scratch/_q-return-split.mjs
 */
const base = process.argv[2] || 'http://127.0.0.1:8090'
const DOC_ID = 856
const OUT_NO = 'LL-2026-11-0047'

async function call(path, body, token, method = 'POST') {
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || (j.code && j.code !== 200)) throw new Error(`${path} -> ${r.status} ${JSON.stringify(j).slice(0, 500)}`)
  return j.data ?? j
}

const login = await call('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })
const token = login.token
console.log('登录 OK')

// ① 仓管审核生产领料单(过账)
const audit = await call('/api/px/callButton', {
  panelCode: 'MATERIAL_OUT', buttonName: '审核', formData: { 编号: OUT_NO }, buttonParam: {},
}, token)
console.log('审核:', JSON.stringify(audit).slice(0, 200))

// ② 可退单据列表:应能看到这张单 + 最近退料单号字段
const list = await call('/api/px/mobilePick/returnables?keyword=' + encodeURIComponent(OUT_NO), null, token, 'GET')
console.log('可退列表:', (list.list || []).map((d) => `${d.领料单号} 可退=${d.可退数量} 最近退料单号=${d.最近退料单号 || '(空)'}`))

// ③ 扫物料码:应回两个批次(TESTB-01/02)
const scan = await call('/api/px/mobilePick/returnScan', { id: DOC_ID, code: 'YJ-XWR-058' }, token)
console.log('扫 YJ-XWR-058:可退=', scan.可退数量, '批次=', JSON.stringify(scan.批次明细))

// ④ 提交退料:指定退第二批 400 + 第一批 100(一次退 500),应拆成 2 行
const sub = await call('/api/px/mobilePick/submitReturn', {
  id: DOC_ID,
  items: [{ code: 'YJ-XWR-058', qty: 500, 批号: 'TESTB-20261124-02', 仓库: '恒亿仓' }],
}, token)
console.log('提交退料:', JSON.stringify(sub, null, 2))
