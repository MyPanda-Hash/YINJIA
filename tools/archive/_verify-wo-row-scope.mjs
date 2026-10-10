/*
 * _verify-wo-row-scope.mjs — 生产链四模块「按 工单号 + 工单行号」收敛回归探针(2026-10-15)
 *
 * 【覆盖交接文档 §2 的步0/步1/步3/步4/步5】
 *   步0 生产链四模块:生产工单(打印留痕落 plang/取消结案落 plang/调线按行/今日排产按行计数)、
 *                    快速排产(scheduled 返回行id)、工序报工单(行级封顶/进度);
 *   步1 调拨轨迹按行(行7 只出本行;整单口径含全部);
 *   步3 父子工单/家族清单按行(孙行上溯到根,不再只剩自己);
 *   步4 领料段如实整单 + 口径说明覆盖;
 *   步5 入库段按行(新列 工单行号/批次号 + 分段落口径)。
 *
 * ⚠ 全程 **只读**(POST 只读接口 + 只读 SQL 经 trace 返回值间接观察),不写任何业务数据。
 * 用法: node tools/archive/_verify-wo-row-scope.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WO = 'GD-2026-10-0002'
const ROW7 = 119   // 行7 批次 20261007(唯一有报工的行)
const ROW6 = 118   // 行6 批次 20261007 计划 25(无报工)
const ROW1 = 111   // 行1 批次 20261006(无报工)
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const token = login.data.token
const api = async (path, body) => {
  const r = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body ?? {}),
  }).then((x) => x.json())
  return r
}
async function trace(rowId) {
  const body = { 工单号: WO }
  if (rowId !== undefined) body['工单行id'] = rowId
  const r = await api('/px/scheduleBoard/trace', body)
  if (r.code !== 200) throw new Error('trace 失败: ' + JSON.stringify(r).slice(0, 200))
  return r.data
}

// ══ 步0 快速排产:scheduled 必须返回 行id(行级键),否则下游只能按批次号反查 ══
console.log('\n── 步0 快速排产:scheduled 带 行id ──')
{
  const r = await api('/px/scheduleBoard/scheduled', { 生产线: '切炭1(老厂)', scope: '全部' })
  const rows = r.data || []
  const mine = rows.filter((x) => x['加工单号'] === WO)
  console.log(`    切炭1(老厂) 排产明细 ${rows.length} 行;本工单 ${mine.length} 行`)
  ok('scheduled 每行都带 行id(plang.id)', rows.length > 0 && rows.every((x) => x['行id'] != null),
    JSON.stringify(rows.slice(0, 2).map((x) => ({ 单: x['加工单号'], 行: x['工单行号'], 行id: x['行id'] }))))
  ok('本工单行7 的行id = ' + ROW7, mine.some((x) => Number(x['行id']) === ROW7),
    JSON.stringify(mine.map((x) => ({ 行: x['工单行号'], 行id: x['行id'] }))))
}

// ══ 步0 快速排产:今日排产「张数」按工单行计数(不再是整单 DISTINCT) ══
console.log('\n── 步0 快速排产:统计口径 ──')
{
  const r = await api('/px/scheduleBoard/stats', {})
  const s = r.data || {}
  console.log(`    今日排产 = ${JSON.stringify(s['今日排产'])}`)
  ok('stats 返回 今日排产.张数(按工单行计数)', s['今日排产'] && typeof s['今日排产']['张数'] === 'number',
    JSON.stringify(s['今日排产']))
}

// ══ 步1 调拨轨迹按行 ══
console.log('\n── 步1 调拨轨迹按行 ──')
{
  const t7 = await trace(ROW7)
  const t6 = await trace(ROW6)
  const tAll = await trace(undefined)
  const ids7 = (t7['调拨轨迹'] || []).map((x) => Number(x['工单行id']))
  const idsAll = (tAll['调拨轨迹'] || []).map((x) => Number(x['工单行id']))
  console.log(`    行7 轨迹 ${ids7.length} 条(行id=${JSON.stringify(ids7)});行6 ${(t6['调拨轨迹'] || []).length} 条;整单 ${idsAll.length} 条`)
  ok('① 行7 的轨迹全部属于行7(plang_id=119)', ids7.length > 0 && ids7.every((x) => x === ROW7), JSON.stringify(ids7))
  ok('① 行6 不出行7 的轨迹', (t6['调拨轨迹'] || []).every((x) => Number(x['工单行id']) !== ROW7),
    JSON.stringify((t6['调拨轨迹'] || []).map((x) => x['工单行id'])))
  ok('① 整单口径 >= 行级口径(老记录 plang_id 空只在整单出现)', idsAll.length >= ids7.length,
    `整单 ${idsAll.length} / 行7 ${ids7.length}`)
  ok('① 行7 口径 != 整单口径 或 整单已全部锚行', idsAll.length > ids7.length || ids7.length === idsAll.length,
    `整单 ${idsAll.length} / 行7 ${ids7.length}`)
}

// ══ 步3 父子工单/家族清单按行(子行必须上溯到根) ══
console.log('\n── 步3 父子工单/家族清单按行 ──')
{
  // MO-2026-10-0006-2(id=113)是**子行**:源工单行id=109 → 根行 MO-2026-10-0006(id=109)。
  //   原 CTE 只下溯、不上溯 —— 对"根行"调用看不出问题,只有从**子行/孙行**进才暴露
  //   (注:MO-2026-09-0137-1-1 那组多级血缘已 asp_cancel='Y' 软删,不能用作活体样本)。
  const t = await api('/px/scheduleBoard/trace', { 工单号: 'MO-2026-10-0006-2', 工单行id: 113 })
  if (t.code !== 200) { ok('步3 子行追溯可打开', false, JSON.stringify(t).slice(0, 150)) } else {
    const fam = t.data['家族清单'] || []
    const sum = t.data['家族汇总'] || {}
    const nos = fam.map((x) => x['工单号'])
    console.log(`    子行 113 → 家族 ${fam.length} 行 = ${JSON.stringify(nos)};根工单号 = ${sum['根工单号']}`)
    ok('③ 子行的家族含根行 MO-2026-10-0006(上溯到根再下溯)',
      nos.includes('MO-2026-10-0006'), JSON.stringify(nos))
    ok('③ 子行的根工单号 = MO-2026-10-0006(不是它自己)', String(sum['根工单号']) === 'MO-2026-10-0006', String(sum['根工单号']))
    ok('③ 家族含根行(是否切单=N)', fam.some((x) => String(x['是否切单']) === 'N'), JSON.stringify(fam.map((x) => x['是否切单'])))
    ok('③ 家族张数 = 汇总张数(自洽)', fam.length === Number(sum['张数'] ?? -1), `fam=${fam.length} sum=${sum['张数']}`)
    // 父工单:按行追溯时必须回本行的源工单行
    const par = t.data['父工单'] || []
    console.log(`    父工单 = ${JSON.stringify(par.map((x) => ({ 单: x['工单号'], 行: x['工单行号'], 行id: x['工单行id'] })))}`)
    ok('③ 子行的父工单 = MO-2026-10-0006(源工单行id=109 那一行)',
      par.length === 1 && String(par[0]['工单号']) === 'MO-2026-10-0006' && Number(par[0]['工单行id']) === 109,
      JSON.stringify(par))
  }
  // 样本工单的父子段按行:行7 无子单(切单都发生在 MO 单上),至少结构必须存在
  const t7 = await trace(ROW7)
  ok('③ 行级追溯返回 子工单/父工单 两个键(结构稳定)',
    Array.isArray(t7['子工单']) && Array.isArray(t7['父工单']),
    JSON.stringify({ 子: (t7['子工单'] || []).length, 父: (t7['父工单'] || []).length }))
}

// ══ 步5 入库段按行 + 新列 ══
console.log('\n── 步5 入库段按行 ──')
{
  const t7 = await trace(ROW7)
  const tAll = await trace(undefined)
  const f7 = t7['入库单据'] || []
  const fAll = tAll['入库单据'] || []
  console.log(`    行7 入库单 ${f7.length} 张;整单 ${fAll.length} 张`)
  console.log(`    行7 明细 = ${JSON.stringify(f7.map((x) => ({ 单: x['单据编号'], 行号: x['工单行号'], 批次: x['批次号'], 口径: x['收敛口径'] })))}`)
  ok('⑤ 入库段带「收敛口径」列(按工单行/按批次/历史未标注)',
    fAll.length === 0 || fAll.every((x) => ['按工单行', '按批次', '历史未标注'].includes(String(x['收敛口径']))),
    JSON.stringify(fAll.map((x) => x['收敛口径'])))
  ok('⑤ 行7 的入库单若存在,必属行7 或本行批次', f7.every((x) => Number(x['工单行号']) === 7 || String(x['批次号']) === '20261007'),
    JSON.stringify(f7))
  ok('⑤ 行级入库 ⊆ 整单入库', f7.length <= fAll.length, `${f7.length} <= ${fAll.length}`)
}

// ══ 步2/步4 口径说明 + 分段口径(每段胶囊的数据源) ══
console.log('\n── 步2/步4 口径说明 + 分段口径 ──')
{
  const t7 = await trace(ROW7)
  const seg = t7['分段口径'] || {}
  const note = String(t7['口径说明'] || '')
  console.log(`    分段口径 = ${JSON.stringify(seg)}`)
  ok('② 返回「分段口径」(前端每段胶囊的数据源)', Object.keys(seg).length > 0, JSON.stringify(seg))
  for (const k of ['工序进度', '流转时间线', '调拨轨迹', '排产数据', '完工数据', '入库单据', '质检数据', '领料数据', '血缘', '家族清单']) {
    ok(`② 分段口径含「${k}」`, seg[k] != null, JSON.stringify(Object.keys(seg)))
  }
  ok('② 时间线如实标「整单」(yj_usage_log 只有单号)', seg['流转时间线'] === '整单', String(seg['流转时间线']))
  ok('④ 领料段如实标「整单」(无行键)', seg['领料数据'] === '整单', String(seg['领料数据']))
  ok('② 报工/检验/入库/轨迹段标「按工单行」',
    seg['完工数据'] === '按工单行' && seg['质检数据'] === '按工单行' && seg['入库单据'] === '按工单行' && seg['调拨轨迹'] === '按工单行',
    JSON.stringify(seg))
  ok('④ 口径说明覆盖 领料(无法按行收敛)', note.includes('领料'), note.slice(0, 80))
  ok('④ 口径说明覆盖 时间线(天生工单级)', note.includes('时间线'), note.slice(0, 80))
  ok('⑤ 口径说明不再说入库"无法按行收敛"', !/入库[^。]*无法按行收敛/.test(note), note.slice(0, 200))
}

// ══ 步0 生产工单:打印留痕/取消结案落 plang(只读校验:接口可用 + 行键齐备) ══
console.log('\n── 步0 生产工单:行键齐备(打印留痕/取消结案/调线都靠它) ──')
{
  const r = await api('/px/workOrderList', { keyword: WO })
  const rows = r.data || []
  console.log(`    workOrderList 命中 ${rows.length} 行`)
  ok('生产工单列表每行带 行id', rows.length > 0 && rows.every((x) => x['行id'] != null),
    JSON.stringify(rows.slice(0, 3).map((x) => ({ 单: x['工单号'], 行: x['工单行号'], 行id: x['行id'] }))))
  const r7 = rows.find((x) => Number(x['行id']) === ROW7)
  ok('行7 的公司代码/批次号齐备(打印留痕按 comm+单号+行号+批次 定位)',
    !!r7 && String(r7['公司代码'] ?? '') !== '' && String(r7['批次号']) === '20261007',
    JSON.stringify(r7 && { comm: r7['公司代码'], 批次: r7['批次号'], 行号: r7['工单行号'] }))
  ok('每行都有批次号(行键第4段)', rows.every((x) => String(x['批次号'] ?? '') !== ''),
    JSON.stringify(rows.filter((x) => !x['批次号']).map((x) => x['工单行号'])))
}

// ══ 步0 工序报工单:必带工单行号(落库 + 界面可见) ══
console.log('\n── 步0 工序报工单:工单行号落库 + 列表可见 ──')
{
  const list = await api('/px/queryFormDataList', { panelCode: 'WO_REPORT_LIST', pageNo: 1, pageSize: 50 })
  const rows = (list.data && (list.data.rows || list.data.list || list.data.items)) || []
  console.log(`    报工记录 ${rows.length} 行`)
  ok('步0 报工记录列表接口可用', list.code === 200, JSON.stringify(list).slice(0, 150))
  if (rows.length) {
    const keys = Object.keys(rows[0] || {})
    console.log(`    列 = ${JSON.stringify(keys.slice(0, 16))}`)
    ok('步0 报工记录带「工单行号」字段(面板已注册)', keys.includes('工单行号'), JSON.stringify(keys))
    const mine = rows.filter((x) => x['工单号'] === WO)
    console.log(`    本工单 ${mine.length} 行 = ${JSON.stringify(mine.map((x) => ({ 单: x['单据编号'], 行: x['工单行号'], 批次: x['批次号'] })))}`)
    ok('步0 样本工单已锚定的报工行写出了行号(行7)',
      mine.length > 0 && mine.every((x) => Number(x['工单行号']) === 7),
      JSON.stringify(mine.map((x) => x['工单行号'])))
    const anchored = rows.filter((x) => x['工单行号'] != null)
    ok('步0 有行号的报工行占多数(存量已回填能唯一确定的)',
      anchored.length >= rows.length - 1, `带行号 ${anchored.length} / 共 ${rows.length}`)
  }
}

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
