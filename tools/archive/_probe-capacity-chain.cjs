/**
 * _probe-capacity-chain.cjs —— 产能对比「真实链路」验收:工单 → 调线到成型1线 → 报工审核 → 看板出数
 *
 * 2026-10-08 用户口径:「那些产能要和报工的数据挂钩的」。
 * 本探针不造 SQL、不改库结构,走**和生产一模一样的接口**:
 *   ① 登录 **测试账套**(factory=YJ_TEST;并断言令牌确实是 YJ_TEST —— 正式库绝不能被本探针碰到)
 *   ② /px/scheduleBoard/reassign  把一张工单调到「成型1线」(该线在产线档案里有日产能)
 *   ③ /px/callButton WO_REPORT 保存  → 建报工单(工序=成型,走工艺路线 GY-CB-STD 的第一道)
 *   ④ /px/callButton WO_REPORT 审核  → 后端把排产产线镜像进报工行(scjl.scxmc)
 *   ⑤ /api/dashboard/capacity?period=day → 断言「成型1线」的实际产出 = 报工数量
 *
 * 前置(演示账套的数据状态,不是链路的一部分):快照里 25 张工单全是**已结案**(ja='T'),
 * 而报工守卫拒绝结案工单 ⇒ 先解开一张:
 *   UPDATE plang SET ja=NULL WHERE pl_no=N'GD2608100002';   -- 仅 HSDZ_MES_TEST
 *
 * 用法: node tools/archive/_probe-capacity-chain.cjs [工单号]
 */
const API = 'http://127.0.0.1:8090/api'
const MO = process.argv[2] || 'GD2608100002'
const QTY = Number(process.argv[3] || 300)
const LINE = '成型1线'
const ok = (m) => console.log('  ✅ ' + m)
const bad = (m) => { console.log('  ❌ ' + m); process.exitCode = 1 }

async function api(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  const text = await res.text()
  let json = null; try { json = JSON.parse(text) } catch { }
  return { status: res.status, json, text }
}
async function apiGet(path, token) {
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } })
  const text = await res.text()
  let json = null; try { json = JSON.parse(text) } catch { }
  return { status: res.status, json, text }
}

;(async () => {
  console.log(`\n=== 产能对比·真实链路(${MO} → ${LINE} 报工 ${QTY})===`)

  // ① 登录测试账套
  const login = await api('/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })
  const token = login.json?.data?.token
  if (!token) { bad('登录失败: ' + login.text.slice(0, 200)); return }
  const factory = login.json.data.user.factory
  if (factory !== 'YJ_TEST') { bad(`令牌账套不是 YJ_TEST(实为 ${factory}),为避免污染正式库已中止`); return }
  ok(`登录成功(账套 ${factory})`)

  // 记下改造前的实际产出(用于对比)
  const before = (await apiGet('/dashboard/capacity?period=day', token)).json?.data
  const b0 = (before?.rows || []).find((r) => r.name === LINE)
  console.log(`  改造前:锚点日=${before?.anchor} ${LINE} 实际=${b0?.actual} 上限=${b0?.limit}`)

  // ② 调线到成型1线(真链路:批量调线接口;产线名取自产线档案)
  let r = await api('/px/scheduleBoard/reassign', { rows: [{ 加工单号: MO }], 目标生产线: LINE }, token)
  const moved = r.json?.data?.['调线数'] ?? r.json?.data?.['成功数'] ?? JSON.stringify(r.json?.data || {})
  r.status === 200 ? ok(`调线到「${LINE}」→ ${moved}`) : bad('调线失败: ' + r.text.slice(0, 250))

  // ③ 建报工单(工序=成型 = 工艺路线 GY-CB-STD 第一道,不跳序)
  const today = new Date().toISOString().slice(0, 10)
  r = await api('/px/callButton', {
    panelCode: 'WO_REPORT',
    buttonName: '保存',
    formData: { 单据日期: today, detail: { items: [{ 工单号: MO, 工序: '成型', 报工数量: QTY }] } },
    buttonParam: {},
  }, token)
  const bg = r.json?.data?.['编号'] || r.json?.data?.['单据编号']
  if (r.status !== 200 || !bg) { bad('建报工单失败: ' + r.text.slice(0, 300)); return }
  ok(`报工单已建:${bg}`)

  // ④ 审核 → 后端把排产产线镜像进报工行
  r = await api('/px/callButton', { panelCode: 'WO_REPORT', buttonName: '审核', formData: { 编号: bg }, buttonParam: {} }, token)
  r.status === 200 ? ok('报工单审核通过') : bad('报工审核失败: ' + r.text.slice(0, 300))

  // ⑤ 看板出数:断言**增量**(探针可重复跑,累计值不是常量)
  const after = (await apiGet('/dashboard/capacity?period=day', token)).json?.data
  const a1 = (after?.rows || []).find((r) => r.name === LINE)
  console.log(`  改造后:锚点日=${after?.anchor} ${LINE} 实际=${a1?.actual} 上限=${a1?.limit} 达成=${a1?.pct}%`)
  const delta = Number(a1?.actual || 0) - Number(b0?.actual || 0)
  delta === QTY
    ? ok(`产能对比已吃到本次报工:${LINE} 实际产出 ${b0?.actual} → ${a1?.actual}(+${QTY})`)
    : bad(`本次报工未按预期计入:增量 ${delta} ≠ ${QTY}(前 ${b0?.actual} → 后 ${a1?.actual})`)
  a1 && Number(a1.pct) === Math.round((Number(a1.actual) / Number(a1.limit)) * 100)
    ? ok(`达成率自洽:${a1.actual} / ${a1.limit} = ${a1.pct}%`)
    : bad(`达成率不对:${a1?.pct}%(应为 ${Math.round((Number(a1?.actual) / Number(a1?.limit)) * 100)}%)`)

  console.log(process.exitCode ? '\n结果: FAIL' : '\n结果: PASS')
})().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
