// 接口验收(只走 fetch,不 spawn 子进程):产成品入库单 ①「不合格数量」可填可落库 ②门禁按「是否过程检验」豁免
// 前置:fixture-setup.sql 已执行;后置:verify-db.sql 查库 + fixture-cleanup.sql 清理。
const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const DOC_A = 'FI-GATE-QTY-A'
const DOC_B = 'FI-GATE-QTY-B'
const results = []
const ok = (name, cond, detail) => { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`) }

const call = async (path, body, token) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  return JSON.parse(await r.text())
}
const get = async (path, token) => {
  const r = await fetch(BASE + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  return JSON.parse(await r.text())
}

const login = await call('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' })
const token = login?.data?.token
ok('登录 YJ_TEST 成功', login.code === 200 && !!token, `code=${login.code}`)

// ① 面板元数据:明细里有「不合格数量」,排 实收数量 之后,可编辑、非必填
const cfg = await get('/api/px/getPanelConfig?panelCode=FINISH_IN', token)
const fields = (cfg?.data?.detail?.tabs || []).find((t) => t.key === 'items')?.fields || []
const names = fields.map((f) => f.dataName)
const iFail = names.indexOf('不合格数量')
const iReal = names.indexOf('实收数量')
const fFail = fields[iFail] || {}
ok('面板明细含「不合格数量」', iFail >= 0, `下标=${iFail}`)
ok('「不合格数量」紧随「实收数量」', iReal >= 0 && iFail === iReal + 1, `实收=${iReal} 不合格=${iFail}`)
ok('「不合格数量」可编辑且非必填', !!fFail.dataName && !fFail.readonly && !fFail.isRequired, JSON.stringify(fFail))

// ② 带「不合格数量=2」保存草稿(单据 A)
const desc = (await get(`/api/px/getFormDescriptor?panelCode=FINISH_IN&code=${DOC_A}`, token))?.data || {}
const head = { ...(desc.data || {}), 编号: DOC_A, 单据编号: DOC_A }
delete head['检测周期']
delete head['单据状态']
const items = (desc?.detailData?.items || []).map((it) => ({ ...it }))
if (items.length) items[0]['不合格数量'] = 2
const saved = await call('/api/px/callButton', {
  panelCode: 'FINISH_IN', buttonName: '保存为草稿',
  formData: { ...head, detail: { items } }, buttonParam: {},
}, token)
ok('带「不合格数量=2」保存为草稿成功', saved.code === 200, `code=${saved.code} msg=${saved.message || ''}`)

// ③ 单据 A(物料未勾过程检验)提交审批:应放行
const subA = await call('/api/px/callButton', { panelCode: 'FINISH_IN', buttonName: '提交审批', formData: { 编号: DOC_A }, buttonParam: {} }, token)
ok('未勾过程检验 ⇒ 提交审批放行', subA.code === 200, `code=${subA.code} msg=${subA.message || ''}`)

// ④ 单据 B(物料 T410 临时勾=是)提交审批:应仍被门禁拦下
const subB = await call('/api/px/callButton', { panelCode: 'FINISH_IN', buttonName: '提交审批', formData: { 编号: DOC_B }, buttonParam: {} }, token)
const msgB = String(subB.message || '')
ok('勾了过程检验 ⇒ 仍被门禁拦下', subB.code !== 200 && msgB.includes('必须关联'), `code=${subB.code} msg=${msgB}`)

const pass = results.filter((r) => r.pass).length
console.log(`\n== 接口验收 ${pass}/${results.length} PASS ==`)
process.exit(pass === results.length ? 0 : 1)
