/**
 * _api-pick-audit-cycle.mjs — 库存流水唯一键改粒度后的回归探针(测试账套)
 *
 * 验的是什么:StockFlowService.post 的三条语句(存在性判断 / 弃审红冲 / 重审复活)
 * 现在都按 (src, rid, 物料编码, 批号) 定位 —— 占位符从 2 个变成 4/6 个,拼错就是运行期 SQL 异常。
 * 所以必须真走一遍「弃审 → 重审」,并核对流水的**行数不变、行 id 不变**(复活而不是新插)。
 *
 * 用法(8090 在跑):
 *   node tools/archive/_outh-one-wo-multi-material-20261020/_api-pick-audit-cycle.mjs SCLL-20261014-00009
 *   node ... --unaudit-only   # 只弃审(配合 SqlRunner 取证,别把测试账套的单子丢在弃审状态)
 */
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const no = process.argv[2]
const unauditOnly = process.argv.includes('--unaudit-only')
if (!no) throw new Error('用法:node _api-pick-audit-cycle.mjs <材料出库单号>')

const r0 = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})
const token = (await r0.json())?.data?.token
if (!token) throw new Error('登录失败')

async function press(button, expectConflict) {
  const r = await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode: 'MATERIAL_OUT', buttonName: button, formData: { 单据编号: no, 编号: no } }),
  })
  const j = await r.json()
  const msg = JSON.stringify(j?.data ?? j?.message ?? '').slice(0, 160)
  // 「单据已是已审核状态」= 单据级幂等守卫先拦下(流水根本不会被再写一遍)—— 正是我们要的结果
  if (expectConflict && r.status === 409 && /已审核/.test(msg)) {
    console.log(` ${button}(连点第二次) → HTTP 409 ${msg}  ← 预期:单据级幂等守卫`)
    return
  }
  console.log(` ${button} → HTTP ${r.status} ${msg}`)
  if (r.status >= 400) throw new Error(`${button} 失败:${j?.message || r.status}`)
}

await press('弃审')
if (!unauditOnly) {
  await press('审核')
  await press('审核', true)   // 连点两次:幂等,不应产生第二行
}
