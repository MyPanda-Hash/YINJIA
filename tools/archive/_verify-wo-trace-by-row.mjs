/*
 * _verify-wo-trace-by-row.mjs — 工单追溯「按 工单号 + 工单行号」回归探针(2026-10-15,一次性)
 *
 * 【修的是什么】追溯各段以前只按 工单号 过滤 ⇒ 同工单号的多行/多批次数据混在一起。
 *   实例 GD-2026-10-0002:8 行 / 3 批次(行1-3=20261006,行4-7=20261007,行8=20261010),
 *   在产的是**行7**;修复前检验段按工单号带回 **7 张**(其中 6 张属 20261006)。
 *
 * 【断言(全部只读)】
 *   ① 行7(行id=119) → 检验段**只有 CX-2026-10-0017**;20261006 的 6 张一张不出;
 *   ② 行7 → 头.工单行号=7、批次号=20261007、追溯口径=按工单行;报工段只有 成型/56000;
 *   ③ 行1(行id=111) → 检验段**不含任何 20261007 的单**(该行无报工 ⇒ 正确结果是空集),
 *      且头.批次号=20261006;
 *   ④ 不带行id(整单口径) → 追溯口径=整单,检验段=7 张(旧行为保留但被显式标注)。
 * ⚠ 全程 **POST 只读接口**,不写任何数据。
 * 用法: node tools/archive/_verify-wo-trace-by-row.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = 'GD-2026-10-0002'
const ROW7 = 119      // plang.id 行7(批次 20261007,产线 切炭1(老厂))
const ROW1 = 111      // plang.id 行1(批次 20261006)
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const token = login.data.token

async function trace(rowId) {
  const body = { 工单号: WO }
  if (rowId !== undefined) body['工单行id'] = rowId
  const r = await fetch(`${BASE}/api/px/scheduleBoard/trace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  }).then((x) => x.json())
  if (r.code !== 200) throw new Error('trace 失败: ' + JSON.stringify(r).slice(0, 200))
  return r.data
}
const nos = (t) => (t['质检数据'] || []).map((x) => x['检验单号'])
const batchesOf = (t) => [...new Set((t['质检数据'] || []).map((x) => x['批次号']))]

// ── ① 行7 ──────────────────────────────────────────────────────────────────────────────
const t7 = await trace(ROW7)
const n7 = nos(t7)
console.log('    行7 检验段 = ' + JSON.stringify(n7) + '  批次 = ' + JSON.stringify(batchesOf(t7)))
ok('① 行7 只出本行那张 CX-2026-10-0017', n7.length === 1 && n7[0] === 'CX-2026-10-0017', JSON.stringify(n7))
ok('① 行7 不再带出 20261006 的 6 张',
  n7.every((x) => !['CX-2026-10-0011', 'CX-2026-10-0013', 'CX-2026-10-0014', 'QT-2026-10-0006', 'QT-2026-10-0008', 'ZJ-2026-10-0006'].includes(x)),
  JSON.stringify(n7))
ok('② 头.工单行号=7 / 批次号=20261007 / 追溯口径=按工单行',
  String(t7['头']?.['工单行号']) === '7' && String(t7['头']?.['批次号']) === '20261007' && t7['头']?.['追溯口径'] === '按工单行',
  JSON.stringify({ 行号: t7['头']?.['工单行号'], 批次: t7['头']?.['批次号'], 口径: t7['头']?.['追溯口径'] }))
const d7 = t7['完工数据'] || []
console.log('    行7 报工段 = ' + JSON.stringify(d7.map((x) => ({ 工序: x['工序'], 完成: x['完成数量'] }))))
ok('② 行7 报工段只有 成型/56000(报工单 BG-2026-10-0038)',
  d7.length === 1 && d7[0]['工序'] === '成型' && Number(d7[0]['完成数量']) === 56000, JSON.stringify(d7))
ok('② 返回里带口径说明', String(t7['口径说明'] || '').includes('按工单行'), String(t7['口径说明'] || '').slice(0, 60))

// ── ③ 行1 ──────────────────────────────────────────────────────────────────────────────
const t1 = await trace(ROW1)
const n1 = nos(t1)
console.log('    行1 检验段 = ' + JSON.stringify(n1) + '  批次 = ' + JSON.stringify(batchesOf(t1)))
ok('③ 行1 不含任何 20261007 的单(不串行)', n1.every((x) => x !== 'CX-2026-10-0017') && !batchesOf(t1).includes('20261007'),
  JSON.stringify({ 单: n1, 批次: batchesOf(t1) }))
ok('③ 行1 头.批次号=20261006 / 追溯口径=按工单行',
  String(t1['头']?.['批次号']) === '20261006' && t1['头']?.['追溯口径'] === '按工单行',
  JSON.stringify({ 批次: t1['头']?.['批次号'], 口径: t1['头']?.['追溯口径'] }))
console.log('    (行1 在 scjl 里没有任何报工单 ⇒ 检验段为空是正确结果:这行还没产出)')
ok('③ 行1 检验段为空(该行无报工)', n1.length === 0, JSON.stringify(n1))

// ── ④ 整单口径(不带行id) ────────────────────────────────────────────────────────────────
const tAll = await trace(undefined)
const nAll = nos(tAll)
console.log('    整单 检验段 = ' + nAll.length + ' 张  批次 = ' + JSON.stringify(batchesOf(tAll)))
ok('④ 不带行id → 追溯口径=整单', tAll['头']?.['追溯口径'] === '整单', String(tAll['头']?.['追溯口径']))
ok('④ 整单口径仍是 7 张(旧行为保留且被标注)', nAll.length === 7, String(nAll.length))

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
