// _probe-spec-notify.cjs — 规格书检验项目变更 → 出货检验计划表核对提醒 验收:
//   ① 建规格书(编号=SPNOT-xxx)+两张出货检验计划表(产品编号=SPNOT-xxx / SPNOT-OTHER),归档
//   ② 规格书走修改闭环进入「修改中」
//   ③ 修改态保存且「检验项目及标准」页(表区=检验要求)发生变化 → 只有产品编号匹配的计划表收到
//      SPEC_ITEMS_CHANGED 消息(经办人+管理员),不匹配的收不到
//   ④ 再次保存但该页无变化(只改备注)→ 不再发新消息
//   ⑤ 消息经 /portal/message/list 可读,参数含 specNo/specName/specCode
//   ⑥ 清理:测试单作废 + 探针消息删除
// 用法: node tools/_probe-spec-notify.cjs [BASE]
const BASE = process.argv[2] || 'http://localhost:8090'
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const api = async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()
  const btn = (panelCode, buttonName, formData) => api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }) })
  const MARK = 'SPNOT-' + Date.now().toString().slice(-6)

  // ① 建单(admin 保存即归档)
  const spec = await btn('RD_SPEC_DOC', '保存', { 规格书种类: '除铅炭棒', 编号: MARK, 名称: '通知探针规格书' })
  const specNo = spec?.data?.['编号']
  ok(!!specNo, `①-1 规格书 ${specNo}(编号=${MARK})`)
  const plan = await btn('RD_INSP_PLAN', '保存', { 产品编号: MARK })
  const planNo = plan?.data?.['编号']
  const plan2 = await btn('RD_INSP_PLAN', '保存', { 产品编号: 'SPNOT-OTHER' })
  const plan2No = plan2?.data?.['编号']
  ok(!!planNo && !!plan2No, `①-2 计划表 ${planNo}(产品编号=${MARK}) / ${plan2No}(不匹配)`)

  // ② 规格书修改闭环 → 修改中
  await btn('RD_SPEC_DOC', '申请修改', { 编号: specNo })
  await btn('RD_SPEC_DOC', '修改审批通过', { 编号: specNo })
  const st = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', pageNo: 1, pageSize: 50 }) })
  const specRow = ((st.data?.rows) || st.data?.list || []).find((r) => (r['单据编号'] || r['编号']) === specNo)
  ok(specRow?.['单据状态'] === '修改中', `② 规格书进入修改中(=${specRow?.['单据状态']})`)

  // ③ 修改态保存,检验项目页新增一行 → 触发通知
  const msgs = async () => ((await api('/api/portal/message/list?limit=200'))?.data) || []
  const before = (await msgs()).length
  const save1 = await btn('RD_SPEC_DOC', '保存', {
    编号: specNo, 规格书种类: '除铅炭棒', 名称: '通知探针规格书',
    detail: { items: [
      { 表区: '检验要求', 序号: '1', 检验项目: '外观·外观', 检验要求: '探针要求A', 检验方法: '目视', 检验依据: 'GB/T' },
    ] },
  })
  ok(save1.code === 200, `③-1 修改态保存成功(${save1.message || 'ok'})`)
  const list1 = await msgs()
  const specMsgs = list1.filter((m) => m['消息码'] === 'SPEC_ITEMS_CHANGED' && m['单据编号'] === planNo)
  ok(specMsgs.length === 1, `③-2 本计划表恰收 1 条 SPEC_ITEMS_CHANGED(=${specMsgs.length})`)
  const msg = specMsgs[0] || {}
  ok(msg['面板编码'] === 'RD_INSP_PLAN', `③-3 消息挂到匹配计划表(${msg['面板编码']} ${msg['单据编号']})`)
  ok(!list1.some((m) => m['消息码'] === 'SPEC_ITEMS_CHANGED' && m['单据编号'] === plan2No), `③-4 不匹配计划表(${plan2No})未收到`)
  let params = msg.params || {}
  if (!params.specNo) { try { params = JSON.parse(msg['参数'] || '{}') } catch {} }
  ok(params.specNo === specNo && params.specCode === specNo && params.specName === '通知探针规格书', `③-5 参数齐(specNo=${params.specNo}, specCode=${params.specCode}, specName=${params.specName})`)

  // ④ 该页无变化的保存(只改备注;行原样带 id 回传,upsert 走更新不重复插入)→ 不再发
  const st2 = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', pageNo: 1, pageSize: 50 }) })
  const specRow2 = ((st2.data?.rows) || st2.data?.list || []).find((r) => (r['单据编号'] || r['编号']) === specNo)
  const keepItems = (specRow2?.detail?.items || []).map((r) => ({ ...r }))
  const save2 = await btn('RD_SPEC_DOC', '保存', {
    编号: specNo, 规格书种类: '除铅炭棒', 名称: '通知探针规格书', 备注: '无关改动',
    detail: { items: keepItems },
  })
  ok(save2.code === 200, `④-1 无关改动保存成功`)
  const list2 = await msgs()
  ok(list2.filter((m) => m['消息码'] === 'SPEC_ITEMS_CHANGED' && m['单据编号'] === planNo).length === 1, `④-2 未新增消息(仍 1 条)`)

  // ⑥ 清理(消息清理走 SQL,由外层 _probe-spec-notify-cleanup.sql 处理;这里作废单据)
  const d1 = await btn('RD_SPEC_DOC', '删除', { 编号: specNo })
  const d2 = await btn('RD_INSP_PLAN', '删除', { 编号: planNo })
  const d3 = await btn('RD_INSP_PLAN', '删除', { 编号: plan2No })
  ok(d1.code === 200 && d2.code === 200 && d3.code === 200, '⑥ 测试单已作废清理')

  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
