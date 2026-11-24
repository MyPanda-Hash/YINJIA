/**
 * 生产领料「明细按 仓库+批号 拆行」端到端验证(测试账套 YJ_TEST / HSDZ_MES_TEST)。
 *
 * 场景:LL-2026-11-0047(台账 id=856,工单 GD-2026-11-0010 第 3 行,组装)
 *   · 行2 YJ-KBL-012 库存分布在**两个仓库** ⇒ 应出 2 行明细
 *   · 行3 YJ-XWR-058 库存带**两个批号**(TESTB-…) ⇒ 应出 2 行明细
 *   · 行1 A-48-16**TB 是半成品 ⇒ 不领料、不进出库单
 * 验完接着核对:领料部门是否=admin 所属部门、领料单号是否串号。
 *
 * 用法:node _scratch/_q-pick-split.mjs [base]   默认 http://127.0.0.1:8090
 */
const base = process.argv[2] || 'http://127.0.0.1:8090'
const DOC_ID = 856

async function post(path, body, token) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || (j.code && j.code !== 200)) throw new Error(`${path} -> ${r.status} ${JSON.stringify(j).slice(0, 400)}`)
  return j.data ?? j
}

async function get(path, token) {
  const r = await fetch(base + path, { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || (j.code && j.code !== 200)) throw new Error(`${path} -> ${r.status} ${JSON.stringify(j).slice(0, 400)}`)
  return j.data ?? j
}

const login = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })
const token = login.token
console.log('登录 OK, factory=', login.user?.factory || '(unknown)')

const doc = await get(`/api/px/mobilePick/doc?id=${DOC_ID}`, token)
console.log('单据:', doc.领料单号, '状态=', doc.状态, '领料部门=', doc.领料部门, doc.领料部门名称)
for (const l of doc.领料明细 || []) {
  console.log(`  #${l.行号} ${l.编码} ${l.名称} 需求=${l.BOM用量} 已领=${l.数量} 半成品=${l.半成品}`)
}

// 逐行扫码 + 写入(半成品跳过 —— 与手机端同一口径)
async function scanAndSet(code, qty, pickBatches) {
  const s = await post('/api/px/mobilePick/scanMaterial', { id: DOC_ID, code, side: 'pick' }, token)
  console.log(`扫码 ${code}: 可用总量=${s.可用总量} 批次行=${(s.批次 || []).length} ->`,
    (s.批次 || []).map((b) => `${b.仓库}/${b.批号 || '无批次'}=${b.现存量}`).join(', '))
  const batches = pickBatches(s.批次 || [])
  const sum = batches.reduce((a, b) => a + Number(b.数量), 0)
  if (Math.abs(sum - qty) > 0.0001) throw new Error(`${code} 分摊合计 ${sum} ≠ 数量 ${qty}`)
  const r = await post('/api/px/mobilePick/setQty', { id: DOC_ID, side: 'pick', code, qty, batches }, token)
  console.log(`  写入 ${code} ${qty} 分摊=${JSON.stringify(batches)} ⇒ 进度 ${r.已领项数}/${r.物料项数} 可提交=${r.可以提交}`)
  return r
}

// 行2:PE袋 5.8 个 —— 跨两个仓
await scanAndSet('YJ-KBL-012', 5.8, (rows) => {
  const a = rows.find((b) => b.仓库 === '恒亿仓')
  const b = rows.find((b) => b.仓库 === '华北工控仓')
  if (!a || !b) throw new Error('PE袋 没看到两个仓库的库存行:' + JSON.stringify(rows))
  return [
    { 批号: a.批号 || '', 仓库: a.仓库, 仓库编码: a.仓库编码, 数量: 3 },
    { 批号: b.批号 || '', 仓库: b.仓库, 仓库编码: b.仓库编码, 数量: 2.8 },
  ]
})

// 行3:白色无纺布 1000 张 —— 两个批号(造数批次 TESTB-*)
await scanAndSet('YJ-XWR-058', 1000, (rows) => {
  const b1 = rows.find((b) => b.批号 === 'TESTB-20261124-01')
  const b2 = rows.find((b) => b.批号 === 'TESTB-20261124-02')
  if (!b1 || !b2) throw new Error('白色无纺布 没看到两个 TESTB 批次:' + JSON.stringify(rows))
  return [
    { 批号: b1.批号, 仓库: b1.仓库, 仓库编码: b1.仓库编码, 数量: 600 },
    { 批号: b2.批号, 仓库: b2.仓库, 仓库编码: b2.仓库编码, 数量: 400 },
  ]
})

const sub = await post('/api/px/mobilePick/submit', { id: DOC_ID }, token)
console.log('提交:', JSON.stringify(sub, null, 2))
