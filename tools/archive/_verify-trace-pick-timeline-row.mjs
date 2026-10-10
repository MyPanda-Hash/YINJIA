/*
 * _verify-trace-pick-timeline-row.mjs — 追溯「领料数据」+「流转时间线」按工单行号收敛(2026-10-15)
 *
 * 【用户报障/口径】「当前修改流转时间线和领料数据同样要根据工单行号完成」。
 *
 * 【两段的原病症】
 *  · 领料数据:原查询 `WHERE m.[加工单号]=?` 查的是**明细行** bl_material_out.[加工单号] ——
 *    该列实测**全为空**(转领料单只写单头)⇒ 这一段**永远是空的**,用户看到的"领料数据没有"就是这个;
 *  · 流转时间线:yj_usage_log 只记 doc_no(工单号),同工单多行留痕全混;更糟的是有的写入方把行键
 *    拼进 doc_no(如 `GD-2026-10-0002#111`),而查询 `doc_no=@工单号` ⇒ 这些留痕**被静默丢弃**。
 *
 * 【验什么】以 GD-2026-10-0002(8 行)为 fixture,逐行调 /px/scheduleBoard/trace(带 工单行id):
 *   ① 领料数据只出**本行的领料单**(按单头 工单行号 收敛;无行号的工单级老单每行都显示);
 *   ② 流转时间线的每条留痕都带「范围」,且**只出本行 + 工单级**的留痕;
 *   ③ 分两行对比:两行各自看不到对方的留痕/领料单(证明真的按行,不是"都返回同一份")。
 *
 * 只读接口。用法: node tools/archive/_verify-trace-pick-timeline-row.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = 'GD-2026-10-0002'
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const api = async (p, b) => fetch(`${BASE}/api${p}`, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) }).then((x) => x.json())

const list = await api('/px/workOrderList', { keyword: WO })
const rows = (list.data || []).filter((r) => String(r['工单号']) === WO)
console.log(`${WO} 共 ${rows.length} 行:${JSON.stringify(rows.map((r) => ({ 行id: r['行id'], 行号: r['工单行号'] })))}\n`)
const traceOf = async (r) => (await api('/px/scheduleBoard/trace', { 工单号: WO, 工单行id: r['行id'] })).data || {}

// ── ① 领料数据按行:逐行取,断言"本行专属单都在、别的行的专属单都不在" ──
console.log('── ① 领料数据按工单行号 ──')
const picksByRow = new Map()
const ownByRow = new Map()   // 只统计"本行专属"(工单行号>0)的单,工单级老单本来就该每行都出现
for (const r of rows) {
  const t = await traceOf(r)
  const picks = t['领料数据'] || []
  picksByRow.set(Number(r['工单行号']), [...new Set(picks.map((x) => String(x['领料单号'])))])
  ownByRow.set(Number(r['工单行号']),
    [...new Set(picks.filter((x) => String(x['范围']).startsWith('按工单行')).map((x) => String(x['领料单号'])))])
  console.log(`    行${r['工单行号']}: 全部=${JSON.stringify(picksByRow.get(Number(r['工单行号'])))}` +
    ` 其中本行专属=${JSON.stringify(ownByRow.get(Number(r['工单行号'])))}`)
}
const withOwn = [...ownByRow.entries()].filter(([, v]) => v.length > 0)
ok('① 至少有一行能查到**本行专属**领料单(修前这一段永远为空)', withOwn.length > 0,
  `有专属领料的行=${JSON.stringify(withOwn)}`)
const t0 = await traceOf(rows[0])
ok('① 领料数据段口径 = 按工单行', t0['分段口径']?.['领料数据'] === '按工单行',
  String(t0['分段口径']?.['领料数据']))
// 每条领料行都带「范围」(界面据此区分"本行单"与"整单老单")
const allPickRows = (await Promise.all(rows.map((r) => traceOf(r)))).flatMap((t) => t['领料数据'] || [])
ok('① 每条领料记录都带「范围」', allPickRows.every((x) => !!x['范围']),
  JSON.stringify(allPickRows.filter((x) => !x['范围']).slice(0, 2)))
// 交叉只在**本行专属**层做:同一张专属单不可能同时属于两行
let cross = 0
const ownSets = [...ownByRow.entries()].map(([xc, arr]) => [xc, new Set(arr)])
for (const [xc, sa] of ownSets) {
  for (const [xc2, sb] of ownSets) {
    if (xc === xc2) continue
    for (const n of sb) if (sa.has(n)) cross++
  }
}
ok('① 任一两行之间不出现"同一张**专属**领料单"(证明真的按行过滤)', cross === 0, `交叉命中 ${cross} 次`)

// ── ② 流转时间线按行:每条带「范围」,且只出本行 + 工单级 ──
console.log('\n── ② 流转时间线按工单行号 ──')
const tlByRow = new Map()
for (const r of rows) {
  const t = await traceOf(r)
  // ⚠ API 的键名是「时间线」(不是「流转时间线」;后者是**段口径胶囊**用的显示名)——
  //   第一版探针读错了键,把"接口没返回"误判成"功能没生效",实测踩到
  const tl = t['时间线'] || []
  tlByRow.set(Number(r['工单行号']), tl)
  const scoped = tl.filter((x) => String(x['范围']) === '按工单行')
  console.log(`    行${r['工单行号']}: 共 ${tl.length} 条,其中带行键 ${scoped.length} 条` +
    ` = ${JSON.stringify(scoped.map((x) => x['步骤']))}`)
  const bad = tl.filter((x) => !x['范围'])
  ok(`② 行${r['工单行号']} 每条留痕都带「范围」`, bad.length === 0, JSON.stringify(bad))
  const wrong = scoped.filter((x) => Number(x['工单行号']) !== Number(r['工单行号']))
  ok(`② 行${r['工单行号']} 带行键的留痕都属于本行`, wrong.length === 0, JSON.stringify(wrong.map((x) => x['工单行号'])))
}
ok('② 时间线段口径 = 按工单行', t0['分段口径']?.['流转时间线'] === '按工单行',
  String(t0['分段口径']?.['流转时间线']))
// 交叉:两行的"带行键留痕"集合不能重叠(同一行号不可能属于两行)
// 交叉:每行视图里"带行键"的留痕,其 工单行号 只能等于该行 —— 这才是"不串行"的真正判据。
//   (不能用"步骤@时间"去重:2026-10-07 02:11 一次批量撤销给 6 行各留了一条,时间戳天然相同;
//    第一版探针按时间去重,把这 6 条合法留痕误判成"重叠"。)
let badKey = 0
const seenXc = new Set()
for (const [xc, tl] of tlByRow) {
  for (const e of tl.filter((x) => String(x['范围']) === '按工单行' && String(x['步骤']) !== '创建')) {
    if (Number(e['工单行号']) !== Number(xc)) badKey++
    seenXc.add(Number(e['工单行号']))
  }
}
ok('② 每行视图里的带行键留痕,其工单行号都等于该行(不串行)', badKey === 0, `不符 ${badKey} 条`)
// 存量回填的 7 条撤销排产应各归各行 ⇒ 按行看到的行号集合应覆盖多行(而不是只有 1 行)
ok('② 带行键留痕覆盖多行(证明回填把留痕分发到了各行,不是全塞给同一行)',
  seenXc.size >= 2, `覆盖行号=${JSON.stringify([...seenXc].sort((a, b) => a - b))}`)
const undoPerRow = [...tlByRow.entries()].map(([xc, tl]) =>
  [xc, tl.filter((x) => String(x['范围']) === '按工单行' && String(x['步骤']).startsWith('撤销排产')).length])
ok('② 每行最多看到 1 条「撤销排产」留痕(不是把 7 条都堆给每行)',
  undoPerRow.every(([, n]) => n <= 1), JSON.stringify(undoPerRow))
// 回填生效:2026-10-07 那批"撤销排产"原先因 doc_no 带 # 而隐形,现应作为按行留痕出现
const anyUndo = [...tlByRow.values()].some((tl) =>
  tl.some((x) => String(x['范围']) === '按工单行' && String(x['步骤']).startsWith('撤销排产')))
ok('② 存量回填生效:原先隐形的「撤销排产」留痕现已按行出现(不再被丢弃)', anyUndo,
  JSON.stringify(undoPerRow))

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
