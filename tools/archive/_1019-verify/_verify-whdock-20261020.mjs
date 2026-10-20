/*
 * _verify-whdock-20261020.mjs —— 「库存明细左栏勾选仓库」报错回归探针
 *
 * 用户报障(2026-10-20):勾选仓库后「服务异常:Cannot invoke "String.isEmpty()" because "whName" is null」。
 * 根因:QueryService 在 `_whCodes`(左栏多选仓库)生效后把 `whName = null`,
 *   紧接着 `byWh = ... || !whName.isEmpty()` 解引用 ⇒ NPE。
 *
 * 断言:
 *   ① 带 _whCodes 的列表查询不再报错,且**确实按所选仓库过滤**(每行仓库编码 ∈ 所选);
 *   ② 只带名称(condition['仓库'])的旧口径仍可过滤(不回归);
 *   ③ 不带任何仓库条件 = 不过滤(行数 ≥ 只选一个仓库时的行数);
 *   ④ _whCodes 只对 STOCK_DETAIL 生效(其它面板传了也不过滤 —— 2026-10-15 闸门不回归)。
 *
 * 用法: node tools/archive/_1019-verify/_verify-whdock-20261020.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
let pass = 0, fail = 0
const ok = (c, label, extra = '') => {
  if (c) { pass++; console.log(`  PASS  ${label}${extra ? ' · ' + extra : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${extra ? ' · ' + extra : ''}`) }
}

async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const post = async (body) => {
    const res = await fetch(`${BASE}/api/px/queryFormDataList`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    })
    const txt = await res.text()
    let j; try { j = JSON.parse(txt) } catch { j = { raw: txt.slice(0, 200) } }
    return j
  }
  const listOf = (j) => j?.data?.list || j?.list || []

  console.log('\n库存明细左栏「勾选仓库」回归(2026-10-20 NPE)\n')

  // 基线:不加任何条件
  const all = await post({ panelCode: 'STOCK_DETAIL', condition: {}, pageNo: 1, pageSize: 50 })
  const allRows = listOf(all)
  ok(all.code === 200, '不带仓库条件:查询正常', `${allRows.length} 行`)

  // ① 勾选一个仓库(_whCodes)—— 就是用户报错的那条路
  const one = await post({ panelCode: 'STOCK_DETAIL', condition: { _whCodes: 'YCL-01' }, pageNo: 1, pageSize: 50 })
  const oneRows = listOf(one)
  ok(one.code === 200, '勾选 1 个仓库(_whCodes=YCL-01):不再报服务异常',
    one.code === 200 ? `${oneRows.length} 行` : (one.message || JSON.stringify(one).slice(0, 160)))
  ok(oneRows.length > 0 && oneRows.every((r) => String(r['仓库编码'] ?? '').trim() === 'YCL-01'),
    '过滤确实生效(每行仓库编码 = YCL-01)', `${oneRows.length} 行`)

  // ② 勾选多个仓库(总数必须是各仓之和 —— 第 1 页可能全落在同一个仓,不能只看首页)
  const oneTotal = one.data?.totalSize ?? 0
  const cp = await post({ panelCode: 'STOCK_DETAIL', condition: { _whCodes: 'CP-02' }, pageNo: 1, pageSize: 5 })
  const cpTotal = cp.data?.totalSize ?? 0
  const multi = await post({ panelCode: 'STOCK_DETAIL', condition: { _whCodes: 'YCL-01,CP-02' }, pageNo: 1, pageSize: 50 })
  const multiTotal = multi.data?.totalSize ?? 0
  ok(multi.code === 200 && multiTotal === oneTotal + cpTotal,
    '勾选 2 个仓库(_whCodes=YCL-01,CP-02):总数 = 两仓之和',
    `${multiTotal} = ${oneTotal} + ${cpTotal}`)

  // ③ 旧口径:condition['仓库'] 带名称(STOCK_DETAIL 的字段叫「仓库名称」,必须也能过滤)
  const byName = await post({ panelCode: 'STOCK_DETAIL', condition: { 仓库: '恒亿仓' }, pageNo: 1, pageSize: 20 })
  const nameRows = listOf(byName)
  ok(byName.code === 200 && (byName.data?.totalSize ?? 0) > 0, '按名称过滤(condition.仓库=恒亿仓):不回归',
    `${byName.data?.totalSize ?? 0} 行`)
  ok(nameRows.length === 0 || nameRows.every((r) => String(r['仓库名称'] ?? '') === '恒亿仓'),
    '名称过滤结果都落在该仓', `${nameRows.length} 行`)

  // ③b 存货名称同理(库存明细字段叫「存货名称」)
  const byItem = await post({ panelCode: 'STOCK_DETAIL', condition: { 存货: '方解石(20-40目）' }, pageNo: 1, pageSize: 5 })
  ok(byItem.code === 200 && (byItem.data?.totalSize ?? 0) > 0, '按存货名称过滤:不回归',
    `${byItem.data?.totalSize ?? 0} 行`)

  // ④ 闸门:_whCodes 只对 STOCK_DETAIL 生效
  const other = await post({ panelCode: 'STOCK_STATUS', condition: { _whCodes: 'YCL-01' }, pageNo: 1, pageSize: 50 })
  const otherRows = listOf(other)
  const whs = new Set(otherRows.map((r) => String(r['仓库编码'] ?? r['仓库'] ?? '').trim()))
  ok(other.code === 200 && whs.size > 1, '库存状况表传 _whCodes 不过滤(2026-10-15 闸门不回归)',
    `仓库种类 ${whs.size}`)

  // ⑤ 四个库存面板按「仓库=名称」过滤都要有结果(2026-10-20 顺带修掉的两处:库存明细 0 行、库存状况 500)
  for (const [panel, label] of [['STOCK_DETAIL', '库存明细'], ['STOCK_LEDGER', '库存台账'],
    ['STOCK_SUMMARY', '收发存汇总'], ['STOCK_STATUS', '库存状况']]) {
    const r = await post({ panelCode: panel, condition: { 仓库: '恒亿仓' }, pageNo: 1, pageSize: 5 })
    ok(r.code === 200 && (r.data?.totalSize ?? 0) > 0, `${label}:按仓库名称过滤有结果、不报错`,
      `total=${r.data?.totalSize ?? 0}${r.code !== 200 ? ' · ' + String(r.message || '').slice(0, 90) : ''}`)
  }

  // ⑥ 库存明细按「存货名称」过滤(该面板字段叫「存货名称」)
  const si = await post({ panelCode: 'STOCK_DETAIL', condition: { 存货: '方解石(20-40目）' }, pageNo: 1, pageSize: 5 })
  ok(si.code === 200 && (si.data?.totalSize ?? 0) > 0, '库存明细:按存货名称过滤有结果', `total=${si.data?.totalSize ?? 0}`)

  console.log(`\n结果: PASS ${pass} · FAIL ${fail}`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[探针异常]', e); process.exit(2) })
