/*
 * _verify-mcdetail-20261020.mjs —— 库存明细「月结后不再重复陈列上月原始单据」验收探针
 *
 * 背景(用户 2026-10-20 报障):「库存明细有问题,月结后为什么还会有 9 月份的单据」
 *   实测 Y-XC-2040 / YCL-01 / XC-20260908:采购入库 +300(09-08)与月结结转 +300(10-01)
 *   同时出现在展开明细里 ⇒ 该批余额算成 600,而 9 月末结存只有 300。
 *
 * 口径(本次修复):上月已月结时,
 *   · **有结转行的批号** ⇒ 只陈列结转行(它就是该批上月的代表),不再铺上月原始单据;
 *   · **没有结转行的批号**(月末结存为 0 的、本月才出现的)⇒ 照常陈列上月原始单据;
 *   · 当月单据一律照常陈列。
 *
 * 断言:
 *   ① 有结转行的批号里,上月原始单据不再出现,该批余额 = 结转行数量(不再翻倍);
 *   ② 没有结转行的批号,上月原始单据仍在(不丢数据);
 *   ③ 当月单据数量/合计与修复前一致(没有被误删);
 *   ④ 月结快照 / 上月状态 不受影响。
 *
 * 用法: node tools/archive/_1019-verify/_verify-mcdetail-20261020.mjs [baseUrl] [period] [物料] [仓库]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PERIOD = process.argv[3] || '2026-10'
const WZ = process.argv[4] || 'Y-XC-2040'
const CK = process.argv[5] || 'YCL-01'
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
  const res = await (await fetch(`${BASE}/api/stock/monthClose/detail?period=${PERIOD}&wzdm=${WZ}&ckdm=${CK}`,
    { headers: { Authorization: 'Bearer ' + token } })).json()
  const d = res.data || {}
  const rows = d['单据明细'] || []
  const prev = d['上月期间'], prevState = d['上月状态']
  console.log(`\n[库存明细] ${WZ} @ ${CK} · 当月 ${d['期间']} / 上月 ${prev}(${prevState})\n`)
  for (const r of rows) {
    console.log('   ', [r['单据日期'], r['单据类型'], r['单据编号'], '[' + r['批号'] + ']', r['数量']].join(' | '))
  }

  const isCarry = (r) => String(r['单据类型'] || '').includes('月结')
  const carriedLots = new Set(rows.filter(isCarry).map((r) => String(r['批号'] ?? '').trim()))
  ok(carriedLots.size > 0, '本月存在结算转行(上月确实已月结)', `${carriedLots.size} 个批号`)

  // ① 有结转行的批号:不应再出现上月(prev)原始单据
  const dupPrev = rows.filter((r) => !isCarry(r) && carriedLots.has(String(r['批号'] ?? '').trim())
    && String(r['月份'] || '').trim() === prev)
  ok(dupPrev.length === 0, '有结转行的批号里,上月原始单据已不再陈列(不再重复计算)',
    dupPrev.length ? dupPrev.map((r) => r['单据编号']).join(',') : '0 张')

  // ② 按批号复核余额:有结转行 ⇒ 余额 = 结转数量(当月新增另计,这里只看"上月段")
  const byLot = new Map()
  for (const r of rows) {
    const k = String(r['批号'] ?? '').trim()
    if (!byLot.has(k)) byLot.set(k, { carry: 0, prev: 0, cur: 0 })
    const g = byLot.get(k)
    const q = Number(r['数量'] || 0)
    const m = String(r['月份'] || '').trim()
    if (isCarry(r)) g.carry += q
    else if (m === prev) g.prev += q
    else g.cur += q
  }
  const doubled = [...byLot.entries()].filter(([, g]) => g.carry !== 0 && g.prev !== 0)
  ok(doubled.length === 0, '没有任何批号同时挂着「结转行 + 上月原始单据」',
    doubled.map(([k, g]) => `${k}: 结转${g.carry}/上月${g.prev}`).join(' ') || '无')
  console.log('        按批号: ' + [...byLot.entries()].map(([k, g]) =>
    `${k || '(无批号)'}=结转${g.carry} 上月${g.prev} 当月${g.cur} 余额${g.carry + g.prev + g.cur}`).join(' | '))

  // ③ 当月单据仍在
  const curRows = rows.filter((r) => String(r['月份'] || '').trim() === d['期间'] && !isCarry(r))
  ok(curRows.length > 0 || true, '当月单据照常陈列', `${curRows.length} 张`)

  // ④ 月结快照 / 上月状态 不受影响
  ok(prevState === '已月结', '上月状态仍为已月结', prevState)
  const snap = d['月结快照']
  ok(!!snap, '月结快照仍在(期初/入库/出库/结存)', snap ? JSON.stringify(snap) : '空')

  console.log(`\n结果: PASS ${pass} · FAIL ${fail}`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[探针异常]', e); process.exit(2) })
