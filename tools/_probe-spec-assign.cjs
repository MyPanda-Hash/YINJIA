// _probe-spec-assign.cjs — 规格书两级分发(总负责人→责任人)全链路验收(2026-09-12):
//   ① 下发解析总负责人:产品信息表「责任人」=彭于晏(glm53) → buttonState 带 supervisor/supervisorResolved
//   ② 挂起+懒重解:责任人='查无此人XYZ' → resolved=false 且无 SPEC_DISPATCHED;
//      SQL 改好责任人后再查 buttonState → 懒重解补挂(见 bash 侧 SQL 断言 rd_dev_task.负责人)
//   ③ 负责人(glm53)收到 SPEC_DISPATCHED
//   ④ 规格书分发(admin):按 种类+责任人 建草稿单 → created 单号 SD- 开头;specAssign 列表含它且 kinds 非空
//      (SQL 断言:head.编号=产品编号、asp_user1=责任人、saved='N')
//   ⑤ 责任人(tester01)收到 SPEC_ASSIGNED
//   ⑥ 编辑封锁:无关人(SPECT2)保存/申请修改/删除分配单 → 三连 403;
//      责任人/负责人/admin 保存均 200;无关人调 规格书分发 → 403
//   ⑦ 防绕过:以产品码为单号建规格书单 → 403;admin 同操作 → 200(后清理)
//   ⑧ 不误伤:未下发产品的自由键建单 → 200;未分配单跨用户保存(glm53 存 SPECT2 建的单) → 200
//   ⑨ specAssign/doc:有分配(hasAssign=true+owner/supervisor)/无分配(hasAssign=false)两态
//   ⑩ 幂等:同种类重复分发被拒;未分发种类放行;作废单后同种类可重分发(旧分配行收口,SQL 断言)
//   ⑪ 清理:作废全部探针单据(产品信息表/规格书)+ SQL 侧删分配行/还原账号(见 cleanup SQL)
// 用法: node tools/_probe-spec-assign.cjs [BASE](默认 http://localhost:8091)
// 前置: bash 已跑 _probe-spec-assign-prep.sql(tester01 临时启用+SPECT2);结束后跑 cleanup SQL。
// 单据号落盘 tools/_probe-spec-docs.json 供 bash 侧 sqlcmd 断言。
const BASE = process.argv[2] || 'http://localhost:8091'
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
const fs = require('fs')
const docNos = {}

async function main() {
  const loginAs = async (u, p) => (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: u, password: p }) })).json())
  const adminLogin = await loginAs('admin', '123456')
  const supLogin = await loginAs('glm53', '123456')       // 总负责人(彭于晏)
  const t1Login = await loginAs('tester01', '123456')     // 责任人
  const t2Login = await loginAs('SPECT2', '123456')       // 无关第三人
  ok(!!adminLogin?.data?.token && !!supLogin?.data?.token && !!t1Login?.data?.token && !!t2Login?.data?.token, '⓪ 四账号登录(admin/glm53/tester01/SPECT2)')
  const mk = (token) => async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()
  const api = mk(adminLogin.data.token)
  const sup = mk(supLogin.data.token)
  const t1 = mk(t1Login.data.token)
  const t2 = mk(t2Login.data.token)
  const btn = (call, panelCode, buttonName, formData) => call('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }) })
  const MARK = 'SPA' + Date.now().toString().slice(-7)
  const SUP_NAME = '彭于晏' // glm53 real_name

  // 建单两步:首次保存(无编号+无明细)走 directAdd 空白草稿分支;带编号再存一次才走管理员归档路径
  const saveArch = async (fields) => {
    const c = await btn(api, 'RD_PROD_INFO', '保存', fields)
    const no = c?.data?.['编号']
    const c2 = await btn(api, 'RD_PROD_INFO', '保存', { ...fields, 编号: no })
    return { no, st: c2?.data?.['单据状态'] }
  }

  // ① 产品1:责任人=彭于晏 → admin 建单归档 → 产品开发 → buttonState 解析出负责人
  const p1 = await saveArch({ 产品编号: MARK + '-A', 产品名称: '规格书分发探针A', 责任人: SUP_NAME })
  docNos.P1 = p1.no
  ok(!!docNos.P1 && p1.st === '已归档', `①-1 产品信息表 ${docNos.P1} 归档(${p1.st})`)
  const d1a = await btn(api, 'RD_PROD_INFO', '产品开发', { 编号: docNos.P1 })
  ok(d1a.code === 200 && d1a?.data?.supervisor === 'glm53' && d1a?.data?.supervisorResolved === true, `①-2 产品开发返回负责人=glm53(${d1a?.data?.supervisor}/${d1a?.data?.supervisorName})`)
  const bs1 = await api(`/api/px/rdDev/buttonState?docNo=${encodeURIComponent(docNos.P1)}`)
  ok(bs1?.data?.dispatched === true && bs1?.data?.supervisor === 'glm53' && bs1?.data?.supervisorResolved === true, `①-3 buttonState 带总负责人(${bs1?.data?.supervisor}/${bs1?.data?.supervisorName})`)

  // ② 产品2:责任人查无此人 → 下发挂起(resolved=false、无消息);走修改闭环改好责任人后懒重解
  const p2a = await saveArch({ 产品编号: MARK + '-B', 产品名称: '规格书分发探针B', 责任人: '查无此人XYZ' })
  docNos.P2 = p2a.no
  ok(p2a.st === '已归档', `②-0 产品2 归档(${p2a.st})`)
  const d2a = await btn(api, 'RD_PROD_INFO', '产品开发', { 编号: docNos.P2 })
  ok(d2a.code === 200 && d2a?.data?.supervisorResolved === false, `②-1 查无负责人 → 任务挂起(resolved=${d2a?.data?.supervisorResolved})`)
  const glmMsg0 = ((await sup('/api/portal/message/list?limit=200'))?.data) || []
  ok(!glmMsg0.some((m) => m['消息码'] === 'SPEC_DISPATCHED' && m['单据编号'] === docNos.P2), '②-2 挂起时无 SPEC_DISPATCHED')
  // 修改闭环改 责任人(admin:申请修改→修改审批通过→保存再归档),全程纯 API
  await btn(api, 'RD_PROD_INFO', '申请修改', { 编号: docNos.P2 })
  const m2b = await btn(api, 'RD_PROD_INFO', '修改审批通过', { 编号: docNos.P2 })
  ok(m2b?.data?.['单据状态'] === '修改中', `②-3 修改审批通过进入修改中(${m2b?.data?.['单据状态']})`)
  const m2c = await btn(api, 'RD_PROD_INFO', '保存', { 编号: docNos.P2, 产品编号: MARK + '-B', 产品名称: '规格书分发探针B', 责任人: SUP_NAME })
  ok(m2c.code === 200, `②-4a 修改态保存改责任人(${m2c?.data?.['单据状态']})`)
  // 修改态保存不自动归档,走 提交审批→审批通过 收尾归档
  await btn(api, 'RD_PROD_INFO', '提交审批', { 编号: docNos.P2 })
  const m2d = await btn(api, 'RD_PROD_INFO', '审批通过', { 编号: docNos.P2 })
  ok(m2d?.data?.['单据状态'] === '已归档', `②-4b 责任人改好并再归档(${m2d?.data?.['单据状态']})`)
  const bs2 = await api(`/api/px/rdDev/buttonState?docNo=${encodeURIComponent(docNos.P2)}`)
  ok(bs2?.data?.supervisor === 'glm53' && bs2?.data?.supervisorResolved === true, `②-5 产品信息改好后懒重解补挂(${bs2?.data?.supervisor}/${bs2?.data?.supervisorResolved})`)

  // ③ 负责人收到 SPEC_DISPATCHED(产品1)
  const glmMsg1 = ((await sup('/api/portal/message/list?limit=200'))?.data) || []
  ok(glmMsg1.some((m) => m['消息码'] === 'SPEC_DISPATCHED' && m['单据编号'] === docNos.P1), '③ glm53 收到 SPEC_DISPATCHED(产品1)')

  // ④ admin 给产品1分发 [种类+tester01];负责人(glm53)给产品2分发(证明负责人可分发)
  const st1 = await api(`/api/px/specAssign?code=${encodeURIComponent(MARK + '-A')}`)
  const kind = (st1?.data?.kinds || [])[0]
  ok(!!kind && (st1?.data?.kinds || []).length > 0, `④-1 specAssign 下发种类字典非空(${(st1?.data?.kinds || []).length} 种)`)
  const a1 = await btn(api, 'RD_PROD_INFO', '规格书分发', { 编号: docNos.P1, assigns: [{ 规格书种类: kind, 责任人: 'tester01' }] })
  docNos.D1 = a1?.data?.created?.[0]?.['单据编号']
  ok(a1.code === 200 && /^SD-/.test(docNos.D1 || ''), `④-2 admin 分发建单 ${docNos.D1}(${a1?.data?.['单据状态']})`)
  const st1b = await api(`/api/px/specAssign?code=${encodeURIComponent(MARK + '-A')}`)
  ok((st1b?.data?.assigns || []).some((x) => x['单据编号'] === docNos.D1 && x['责任人'] === 'tester01'), '④-3 specAssign 列表含新分配')
  const a2 = await btn(sup, 'RD_PROD_INFO', '规格书分发', { 编号: docNos.P2, assigns: [{ 规格书种类: kind, 责任人: 'tester01' }] })
  docNos.D2 = a2?.data?.created?.[0]?.['单据编号']
  ok(a2.code === 200 && /^SD-/.test(docNos.D2 || ''), `④-4 总负责人(glm53)分发产品2建单 ${docNos.D2}`)
  const a3 = await btn(t2, 'RD_PROD_INFO', '规格书分发', { 编号: docNos.P1, assigns: [{ 规格书种类: kind, 责任人: 'tester01' }] })
  ok(a3.code === 403, `④-5 无关人(SPECT2)调 规格书分发 被拒(code=${a3.code} ${a3.message})`)

  // ⑤ 责任人收到 SPEC_ASSIGNED
  const t1Msg = ((await t1('/api/portal/message/list?limit=200'))?.data) || []
  ok(t1Msg.some((m) => m['消息码'] === 'SPEC_ASSIGNED' && m['单据编号'] === docNos.D1), '⑤-1 tester01 收到 SPEC_ASSIGNED(D1)')
  ok(t1Msg.some((m) => m['消息码'] === 'SPEC_ASSIGNED' && m['单据编号'] === docNos.D2), '⑤-2 tester01 收到 SPEC_ASSIGNED(D2)')

  // ⑥ 编辑封锁:无关人三连 403;责任人/负责人/admin 可存
  const s6a = await btn(t2, 'RD_SPEC_DOC', '保存为草稿', { 编号: docNos.D1, 名称: '越权改' })
  ok(s6a.code === 403 && String(s6a.message || '').includes('该规格书已分发'), `⑥-1 SPECT2 保存被拒(${s6a.message})`)
  const s6b = await btn(t2, 'RD_SPEC_DOC', '申请修改', { 编号: docNos.D1 })
  ok(s6b.code === 403 && String(s6b.message || '').includes('该规格书已分发'), `⑥-2 SPECT2 申请修改被拒(${s6b.message})`)
  const s6c = await btn(t2, 'RD_SPEC_DOC', '删除', { 编号: docNos.D1 })
  ok(s6c.code === 403 && String(s6c.message || '').includes('该规格书已分发'), `⑥-3 SPECT2 删除被拒(${s6c.message})`)
  const s6d = await btn(t1, 'RD_SPEC_DOC', '保存为草稿', { 编号: docNos.D1, 名称: '责任人填写' })
  ok(s6d.code === 200 && s6d?.data?.['单据状态'] === '草稿', `⑥-4 责任人(tester01)保存 OK(${s6d?.data?.['单据状态']})`)
  const s6e = await btn(sup, 'RD_SPEC_DOC', '保存为草稿', { 编号: docNos.D1, 名称: '负责人代填' })
  ok(s6e.code === 200, `⑥-5 总负责人(glm53)保存 OK(${s6e?.data?.['单据状态']})`)
  const s6f = await btn(api, 'RD_SPEC_DOC', '保存为草稿', { 编号: docNos.D1, 名称: '管理员代填' })
  ok(s6f.code === 200, `⑥-6 admin 保存 OK(${s6f?.data?.['单据状态']})`)

  // ⑦ 防绕过:以已下发产品的产品码为单号建规格书单
  const s7a = await btn(t2, 'RD_SPEC_DOC', '保存为草稿', { 编号: MARK + '-A', 名称: '绕过分发' })
  ok(s7a.code === 403 && String(s7a.message || '').includes('须由总负责人'), `⑦-1 SPECT2 以产品码建单被拒(${s7a.message})`)
  const s7b = await btn(api, 'RD_SPEC_DOC', '保存为草稿', { 编号: MARK + '-A', 名称: '管理员建' })
  docNos.BYPASS = s7b?.data?.['编号']
  ok(s7b.code === 200 && docNos.BYPASS === MARK + '-A', `⑦-2 admin 以产品码建单放行(${docNos.BYPASS})`)

  // ⑧ 不误伤:未下发产品的自由键建单;未分配单跨用户保存
  const s8a = await btn(t2, 'RD_SPEC_DOC', '保存为草稿', { 编号: MARK + '-FREE', 名称: '自由键' })
  docNos.FREE = s8a?.data?.['编号']
  ok(s8a.code === 200 && docNos.FREE === MARK + '-FREE', `⑧-1 SPECT2 为未下发键建单放行(${docNos.FREE})`)
  const s8b = await btn(sup, 'RD_SPEC_DOC', '保存为草稿', { 编号: MARK + '-FREE', 名称: '跨用户存未分配单' })
  ok(s8b.code === 200, `⑧-2 glm53 跨用户保存未分配单放行(${s8b?.data?.['单据状态']})`)

  // ⑨ specAssign/doc 两态
  const q9a = await api(`/api/px/specAssign/doc?no=${encodeURIComponent(docNos.D1)}`)
  ok(q9a?.data?.hasAssign === true && q9a?.data?.owner === 'tester01' && q9a?.data?.supervisor === 'glm53', `⑨-1 D1 hasAssign=true owner/supervisor 正确`)
  const q9b = await api(`/api/px/specAssign/doc?no=${encodeURIComponent(MARK + '-FREE')}`)
  ok(q9b?.data?.hasAssign === false, `⑨-2 未分配单 hasAssign=false`)

  // ⑩ 幂等(2026-09-12 用户口径):分发过的种类不再重复分发;作废单后同种类可重分发(旧分配行收口)
  const dup = await btn(api, 'RD_PROD_INFO', '规格书分发', { 编号: docNos.P1, assigns: [{ 规格书种类: kind, 责任人: 'tester01' }] })
  ok(dup.code !== 200 && String(dup.message || '').includes('请勿重复分发'), `⑩-1 已分发种类重复分发被拒(${dup.message})`)
  const kind2 = ((st1?.data?.kinds) || []).find((k) => k !== kind)
  const nd = await btn(api, 'RD_PROD_INFO', '规格书分发', { 编号: docNos.P1, assigns: [{ 规格书种类: kind2, 责任人: 'tester01' }] })
  docNos.D3 = nd?.data?.created?.[0]?.['单据编号']
  ok(nd.code === 200 && /^SD-/.test(docNos.D3 || ''), `⑩-2 未分发种类照常放行 ${docNos.D3}`)
  await btn(api, 'RD_SPEC_DOC', '删除', { 编号: docNos.D2 }) // 草稿直删(作废)
  const rd = await btn(api, 'RD_PROD_INFO', '规格书分发', { 编号: docNos.P2, assigns: [{ 规格书种类: kind, 责任人: 'tester01' }] })
  docNos.D4 = rd?.data?.created?.[0]?.['单据编号']
  ok(rd.code === 200 && /^SD-/.test(docNos.D4 || ''), `⑩-3 作废单后同种类重分发 ${docNos.D4}`)

  // ⑪ 清理:作废探针单据(规格书草稿直删;产品信息表已归档 admin 直删)
  for (const n of [docNos.D1, docNos.D2, docNos.D3, docNos.D4, docNos.BYPASS, docNos.FREE]) {
    if (n) await btn(api, 'RD_SPEC_DOC', '删除', { 编号: n })
  }
  for (const n of [docNos.P1, docNos.P2]) {
    if (n) await btn(api, 'RD_PROD_INFO', '删除', { 编号: n })
  }
  fs.writeFileSync(__dirname + '/_probe-spec-docs.json', JSON.stringify({ MARK, ...docNos, supName: SUP_NAME }, null, 2))
  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  console.log('>>> bash 侧收尾:sqlcmd 断言(head.编号/asp_user1/saved + rd_dev_task.负责人) + _probe-spec-assign-cleanup.sql')
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
