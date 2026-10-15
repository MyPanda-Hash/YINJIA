/*
 * _verify-step-color.mjs — 工单追溯「工序步骤着色」回归探针(2026-10-16,一次性)
 *
 * 【修的是什么】用户报障两条:
 *   ① 「数量报工超过所需要的量已完成却不会变色」—— 后端状态是**四态**(已完工/超产/进行中/未开始),
 *      前端只映射三态,`超产` 落进 else 被判成 wait(灰)⇒ 161/160 显示成"未开始"。
 *   ② 「存在生产报工但是总数量对不上也不会变色为蓝色进行中」—— 工序进度段原按 `wgzt='Y'` 过滤,
 *      草稿(未审)报工被整个滤掉 ⇒ 同一弹窗「完工数据」段列出了报工、步骤条却是 0/灰,自相矛盾;
 *      另有 `gd_id IS NULL` 兜底与完工段 `ISNULL(gd_id,0)=0` 不一致,gd_id=0 的报工被漏计。
 *
 * 【断言(全部只读)】
 *   ① 工序步骤每步都带 **已完成** 布尔与 **待审量** 字段(前端据此着色,不再猜状态字面量);
 *   ② 「已完成」与状态自洽:状态 ∈ {已完工,超产} ⇔ 已完成=true;超产步必须 已完成=true;
 *   ③ 完工量 > 计划量的步,状态必须是「超产」且 **已完成=true**(不再落成"未开始");
 *   ④ 任一(已审量+待审量) > 0 的步,状态**不得**是「未开始」(有报工就必须不是灰);
 *   ⑤ 计划量合计/产出仍只按已审量算(待审不得冒充产量):产出 = 最后一道已审完工量。
 * ⚠ 全程只读(POST 只读接口),不写任何数据。
 * 用法: node tools/archive/_verify-step-color.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const token = login.data.token

/** 取某工单的工序进度(可带行id) */
async function prog(wo, rowId) {
  const body = { 工单号: wo }
  if (rowId !== undefined) body['工单行id'] = rowId
  const r = await fetch(`${BASE}/api/px/processTask/detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  }).then((x) => x.json())
  if (r.code !== 200) throw new Error('detail 失败: ' + JSON.stringify(r).slice(0, 200))
  return r.data
}

// 用「有已审报工」的工单行做样本(生产工单列表 → 取前若干行,逐行验)
const list = await fetch(`${BASE}/api/px/workOrderList`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({}),
}).then((x) => x.json())
const rows = (list.data || []).filter((x) => x['行id'] != null).slice(0, 12)
console.log(`    样本工单行 ${rows.length} 条`)

let checkedSteps = 0
let overSeen = 0
let pendSeen = 0
for (const r of rows) {
  let d
  try { d = await prog(r['工单号'], r['行id']) } catch { continue }
  const steps = d?.['工序步骤'] || []
  if (!steps.length) continue
  const tag = `${r['工单号']}#${r['工单行号']}`

  // ① 字段齐备
  ok(`① ${tag} 每步带「已完成」布尔`, steps.every((s) => typeof s['已完成'] === 'boolean'),
    JSON.stringify(steps.map((s) => ({ 工序: s['工序'], 已完成: s['已完成'] }))))
  ok(`① ${tag} 每步带「待审量」字段`, steps.every((s) => s['待审量'] !== undefined),
    JSON.stringify(steps.map((s) => s['待审量'])))

  // ② 已完成 ⇔ 状态 ∈ {已完工,超产}
  ok(`② ${tag} 「已完成」与状态自洽`, steps.every((s) =>
    (s['状态'] === '已完工' || s['状态'] === '超产') === (s['已完成'] === true)),
    JSON.stringify(steps.map((s) => ({ 工序: s['工序'], 状态: s['状态'], 已完成: s['已完成'] }))))

  // ③ 超产步必须已完成(本次报障的正面)
  for (const s of steps) {
    if (Number(s['完工量']) > Number(s['计划量']) && Number(s['计划量']) > 0) {
      overSeen++
      ok(`③ ${tag} ${s['工序']} 超产(${s['完工量']}/${s['计划量']}) 状态=超产 且 已完成=true`,
        s['状态'] === '超产' && s['已完成'] === true, JSON.stringify({ 状态: s['状态'], 已完成: s['已完成'] }))
    }
  }

  // ④ 有任何报工(已审或待审)就不能是「未开始」
  for (const s of steps) {
    if (Number(s['待审量']) > 0) pendSeen++
    if (Number(s['完工量']) > 0 || Number(s['待审量']) > 0) {
      ok(`④ ${tag} ${s['工序']} 有报工(已审${s['完工量']}/待审${s['待审量']}) ⇒ 状态不是未开始`,
        s['状态'] !== '未开始', JSON.stringify({ 状态: s['状态'] }))
    }
  }
  checkedSteps += steps.length
}

ok('③ 样本里确实存在「超产」步(正面覆盖到报障场景)', overSeen > 0, `overSeen=${overSeen}`)
console.log(`    共校验 ${checkedSteps} 个工序步骤;超产步 ${overSeen} 个;含待审量的步 ${pendSeen} 个`)

// ⑤ 待审量不得计入产出/进度:产出 = 最后一道**已审**完工量
{
  const r = rows[0]
  if (r) {
    const d = await prog(r['工单号'], r['行id'])
    const steps = d?.['工序步骤'] || []
    let lastAudited = 0
    for (let i = steps.length - 1; i >= 0; i--) {
      if (Number(steps[i]['完工量']) > 0) { lastAudited = Number(steps[i]['完工量']); break }
    }
    ok('⑤ 产出 = 最后一道已审完工量(待审不冒充产量)', Number(d['产出']) === lastAudited,
      JSON.stringify({ 产出: d['产出'], 期望: lastAudited }))
    const doneCnt = steps.filter((s) => s['已完成']).length
    ok('⑤ 已完成步骤数 = 已完成步计数', Number(d['已完成步骤数']) === doneCnt,
      JSON.stringify({ 已完成步骤数: d['已完成步骤数'], 期望: doneCnt }))
  }
}

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
