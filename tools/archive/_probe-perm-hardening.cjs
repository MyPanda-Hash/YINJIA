// _probe-perm-hardening.cjs — 权限加固/状态机/留痕/通知 全链路验收(2026-09-12 缺陷修复):
//   ① P1 服务端越权读:glm53 读 WO_ORDER(生产模块) → 403;读 RD_APPROVAL(本模块) → 200
//   ② P1 按钮权限:glm53 无 audit → 审核/审批通过 均被拦
//   ③ P4 保存为草稿不送审:glm53 草稿→填字段再存草稿 → 仍 草稿(旧代码这里会变 审批中)
//   ④ 普通用户保存→自动送审;admin 审批通过 → 已归档 + 审批留痕 SUBMIT→APPROVE
//   ⑤ P3 在途锁定+P7 通知:修改申请中 保存被拒(双方);admin 驳回 → glm53 收 MODIFY_REJECTED
//   ⑤b 删除链:删除申请中 保存被拒;admin 删除审批通过 → 已作废 + glm53 收 DELETE_APPROVED
//   ⑥ P2 自审拦截(需先 SQL 临时授权 can_approve,跑完还原):
//        glm53 批自己提交的单 → 403 编制与审批分离;glm53 审核自己制的单 → 403 制单人相同
//   ⑦ P5 弃审留痕:admin 弃审归档单 → 再编辑保存 → 再归档,modify_log 盖章 rearchive_by(SQL 验证)
//   ⑧ P6 立项人账号锚定:立项申请制单人=glm53 但 申请立项人=查无此人 → TERM_REQUESTED 仍达 glm53
//   ⑨ P10 参照守卫:被实施计划引用的立项申请不可作废;先作废计划后可作废
//   ⑩ 清理:作废全部探针单据(计划先行,立项申请在后)
// 用法: node tools/_probe-perm-hardening.cjs [BASE]
// 前置: bash 侧先执行授权 SQL(glm53 角色 RD_DOM_TEST can_approve='Y'),结束后还原。
// 单据号落盘 tools/_probe-perm-docs.json 供 bash 侧 sqlcmd 断言(shr/modify_log/作废)。
const BASE = process.argv[2] || 'http://localhost:8090'
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
const fs = require('fs')
const docNos = {} // 探针单据号(落盘供 SQL 断言/清理)

async function main() {
  const loginAs = async (u, p) => (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: u, password: p }) })).json())
  const adminLogin = await loginAs('admin', '123456')
  const glmLogin = await loginAs('glm53', '123456')
  ok(!!adminLogin?.data?.token && !!glmLogin?.data?.token, '⓪ 双账号登录(admin/glm53)')
  const mk = (token) => async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()
  const api = mk(adminLogin.data.token)
  const glm = mk(glmLogin.data.token)
  const btn = (call, panelCode, buttonName, formData) => call('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }) })
  const statusOf = async (call, panelCode, no) => {
    const q = await call('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode, pageNo: 1, pageSize: 200, condition: {} }) })
    const r = ((q.data?.rows) || q.data?.list || []).find((x) => (x['单据编号'] || x['编号']) === no)
    return r ? (r['单据状态'] || '(在列无状态)') : '(不在列表)'
  }
  const MARK = 'PRM' + Date.now().toString().slice(-7)

  // ① P1 越权读(跨模块) vs 本模块放行
  const d1 = await glm('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: 'WO_ORDER', pageNo: 1, pageSize: 5 }) })
  ok(d1.code === 403 && String(d1.message || '').includes('查看权限'), `①-1 glm53 读 WO_ORDER 被拦(code=${d1.code} ${d1.message})`)
  const d1b = await glm(`/api/px/getFormDescriptor?panelCode=WO_ORDER&code=x`)
  ok(d1b.code === 403, `①-2 glm53 取 WO_ORDER 表单描述被拦(code=${d1b.code})`)
  const d1c = await glm('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_APPROVAL', pageNo: 1, pageSize: 5 }) })
  ok(d1c.code === 200, `①-3 glm53 读 RD_APPROVAL 放行(code=${d1c.code})`)

  // ② P1 按钮权限:glm53 无 audit → 审批类按钮被拦
  const d2 = await btn(glm, 'RD_APPROVAL', '审核', { 编号: 'X' })
  ok(d2.code === 403 && String(d2.message || '').includes('权限'), `②-1 glm53 审核 被拦(code=${d2.code} ${d2.message})`)
  const d2b = await btn(glm, 'RD_APPROVAL', '审批通过', { 编号: 'X' })
  ok(d2b.code === 403, `②-2 glm53 审批通过 被拦(code=${d2b.code})`)

  // ③ P4 保存为草稿不送审(核心回归:旧代码这里直接变 审批中)
  const t3 = await btn(glm, 'RD_DOM_TEST', '保存为草稿', {})
  docNos.D1 = t3?.data?.['编号']
  ok(!!docNos.D1 && t3?.data?.['单据状态'] === '草稿', `③-1 glm53 新增草稿 ${docNos.D1}(${t3?.data?.['单据状态']})`)
  const t3b = await btn(glm, 'RD_DOM_TEST', '保存为草稿', { 编号: docNos.D1, 备注: '探针P4' })
  ok(t3b.code === 200 && t3b?.data?.['单据状态'] === '草稿', `③-2 填字段再存草稿 → 仍 草稿(${t3b?.data?.['单据状态']})【旧代码=审批中】`)

  // ④ glm53 保存 → 自动送审 → admin 审批通过 → 已归档+留痕
  const t4 = await btn(glm, 'RD_DOM_TEST', '保存', { 编号: docNos.D1 })
  ok(t4.code === 200 && t4?.data?.['单据状态'] === '审批中', `④-1 glm53 保存 → 自动送审(${t4?.data?.['单据状态']})`)
  const t4b = await btn(api, 'RD_DOM_TEST', '审批通过', { 编号: docNos.D1, 审批意见: '探针通过' })
  ok(t4b.code === 200 && t4b?.data?.['单据状态'] === '已归档', `④-2 admin 审批通过 → 已归档(${t4b?.data?.['单据状态']})`)
  const hist = await api(`/api/px/getApprovalHistory?panelCode=RD_DOM_TEST&code=${encodeURIComponent(docNos.D1)}`)
  const acts = (hist?.data || []).map((h) => h.action)
  ok(acts.includes('SUBMIT') && acts.includes('APPROVE'), `④-3 审批留痕 SUBMIT→APPROVE(${acts.join(',')})`)

  // ⑤ P3 修改申请期间锁定 + P7 驳回通知
  const t5a = await btn(glm, 'RD_DOM_TEST', '保存为草稿', {})
  docNos.D2 = t5a?.data?.['编号']
  await btn(glm, 'RD_DOM_TEST', '保存', { 编号: docNos.D2 })
  await btn(api, 'RD_DOM_TEST', '审批通过', { 编号: docNos.D2, 审批意见: '' })
  ok((await statusOf(glm, 'RD_DOM_TEST', docNos.D2)) === '已归档', `⑤-1 D2 归档(${await statusOf(glm, 'RD_DOM_TEST', docNos.D2)})`)
  const t5 = await btn(glm, 'RD_DOM_TEST', '申请修改', { 编号: docNos.D2, 审批意见: '探针改' })
  ok(t5.code === 200 && t5?.data?.['单据状态'] === '修改申请中', `⑤-2 申请修改(${t5?.data?.['单据状态']})`)
  const t5b = await btn(glm, 'RD_DOM_TEST', '保存', { 编号: docNos.D2 })
  ok(t5b.code !== 200 && String(t5b.message || '').includes('修改申请审批期间'), `⑤-3 申请期间 glm53 保存被拒(${t5b.message})`)
  const t5c = await btn(api, 'RD_DOM_TEST', '保存', { 编号: docNos.D2 })
  ok(t5c.code !== 200 && String(t5c.message || '').includes('修改申请审批期间'), `⑤-4 申请期间 admin 保存同样被拒(${t5c.message})`)
  const t5d = await btn(api, 'RD_DOM_TEST', '修改审批驳回', { 编号: docNos.D2, 审批意见: '探针驳回' })
  ok(t5d.code === 200, `⑤-5 admin 修改审批驳回`)
  const glmMsgs = ((await glm('/api/portal/message/list?limit=200'))?.data) || []
  ok(glmMsgs.some((m) => m['消息码'] === 'MODIFY_REJECTED' && m['单据编号'] === docNos.D2), '⑤-6 glm53 收到 MODIFY_REJECTED(此前无通知)')

  // ⑤b 删除申请链:锁定 + 审批通过 + DELETE_APPROVED 通知
  const t5e = await btn(glm, 'RD_DOM_TEST', '保存为草稿', {})
  docNos.D3 = t5e?.data?.['编号']
  await btn(glm, 'RD_DOM_TEST', '保存', { 编号: docNos.D3 })
  await btn(api, 'RD_DOM_TEST', '审批通过', { 编号: docNos.D3, 审批意见: '' })
  const t5f = await btn(glm, 'RD_DOM_TEST', '删除', { 编号: docNos.D3 })
  ok(t5f.code === 200 && t5f?.data?.['单据状态'] === '删除申请中', `⑤b-1 glm53 删除申请(${t5f?.data?.['单据状态']})`)
  const t5g = await btn(glm, 'RD_DOM_TEST', '保存', { 编号: docNos.D3 })
  ok(t5g.code !== 200 && String(t5g.message || '').includes('删除申请审批期间'), `⑤b-2 申请期间保存被拒(${t5g.message})`)
  const t5h = await btn(api, 'RD_DOM_TEST', '删除审批通过', { 编号: docNos.D3, 审批意见: '探针删' })
  ok(t5h.code === 200, `⑤b-3 admin 删除审批通过`)
  const glmMsgs2 = ((await glm('/api/portal/message/list?limit=200'))?.data) || []
  ok(glmMsgs2.some((m) => m['消息码'] === 'DELETE_APPROVED' && m['单据编号'] === docNos.D3), '⑤b-4 glm53 收到 DELETE_APPROVED(此前无通知)')

  // ⑥ P2 自审拦截(前置 SQL 已临时给 glm53 的角色授 RD_DOM_TEST can_approve)
  const t6a = await btn(glm, 'RD_DOM_TEST', '保存为草稿', {})
  docNos.D4 = t6a?.data?.['编号']
  await btn(glm, 'RD_DOM_TEST', '保存', { 编号: docNos.D4 })
  ok((await statusOf(glm, 'RD_DOM_TEST', docNos.D4)) === '审批中', `⑥-1 D4 送审(${await statusOf(glm, 'RD_DOM_TEST', docNos.D4)})`)
  const t6 = await btn(glm, 'RD_DOM_TEST', '审批通过', { 编号: docNos.D4, 审批意见: '自批' })
  ok(t6.code === 403 && String(t6.message || '').includes('提交人相同'), `⑥-2 glm53 批自己提交的单被拒(code=${t6.code} ${t6.message})`)
  const t6b = await btn(api, 'RD_DOM_TEST', '审批通过', { 编号: docNos.D4, 审批意见: 'admin批' })
  ok(t6b.code === 200 && t6b?.data?.['单据状态'] === '已归档', `⑥-3 admin 审批 D4 通过(${t6b?.data?.['单据状态']})`)
  const t6c = await btn(glm, 'RD_DOM_TEST', '保存为草稿', {})
  docNos.D5 = t6c?.data?.['编号']
  const t6d = await btn(glm, 'RD_DOM_TEST', '审核', { 编号: docNos.D5 })
  ok(t6d.code === 403 && String(t6d.message || '').includes('制单人相同'), `⑥-4 glm53 审核自己制的单被拒(code=${t6d.code} ${t6d.message})`)

  // ⑦ P5 弃审留痕:D1 已归档 → admin 弃审 → 再保存 → 再归档(modify_log 由 SQL 断言)
  const t7 = await btn(api, 'RD_DOM_TEST', '弃审', { 编号: docNos.D1 })
  ok(t7.code === 200 && t7?.data?.['单据状态'] === '草稿', `⑦-1 admin 弃审 D1 → 草稿(${t7?.data?.['单据状态']})`)
  const t7b = await btn(api, 'RD_DOM_TEST', '保存', { 编号: docNos.D1, 备注: '弃审后再编辑' })
  ok(t7b.code === 200 && t7b?.data?.['单据状态'] === '已归档', `⑦-2 弃审后再编辑保存 → 再归档(${t7b?.data?.['单据状态']})`)

  // ⑧ P6 立项人账号锚定:制单人=glm53,申请立项人=查无此人(旧姓名匹配路径发不到任何人)
  const aNo = `${MARK}-A1`
  const t8 = await btn(glm, 'RD_APPROVAL', '保存为草稿', { 文档编号: aNo, 申请立项人: '查无此人' })
  ok(t8.code === 200, `⑧-1 glm53 建立项申请草稿(${aNo})`)
  const t8b = await btn(api, 'RD_PLAN', '保存', {})
  docNos.P1 = t8b?.data?.['编号']
  const t8c = await btn(api, 'RD_PLAN', '保存', { 编号: docNos.P1, 文档编号: aNo, 阶段1_计划内容: '探针锚定' })
  ok(t8c?.data?.['单据状态'] === '已归档', `⑧-2 计划 ${docNos.P1} 引用 ${aNo} 并归档`)
  const t8d = await btn(glm, 'RD_PLAN', '申请终止', { 编号: docNos.P1, 阶段序号: '1', 终止原因: '探针锚定' })
  ok(t8d.code === 200, `⑧-3 申请终止提交`)
  const glmMsgs3 = ((await glm('/api/portal/message/list?limit=200'))?.data) || []
  ok(glmMsgs3.some((m) => m['消息码'] === 'TERM_REQUESTED' && m['单据编号'] === docNos.P1), '⑧-4 TERM_REQUESTED 按 asp_user1 锚定到达 glm53(旧路径发0人)')
  await btn(glm, 'RD_PLAN', '撤回终止申请', { 编号: docNos.P1 })

  // ⑨ P10 参照守卫:被计划引用的立项申请不可作废;先作废计划即可
  const gNo = `${MARK}-A2`
  await btn(api, 'RD_APPROVAL', '保存', { 文档编号: gNo, 申请立项人: 'admin' })
  const t9b = await btn(api, 'RD_PLAN', '保存', {})
  docNos.P2 = t9b?.data?.['编号']
  await btn(api, 'RD_PLAN', '保存', { 编号: docNos.P2, 文档编号: gNo, 阶段1_计划内容: '探针守卫' })
  const q9 = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_APPROVAL', pageNo: 1, pageSize: 200 }) })
  const rowA2 = ((q9.data?.rows) || q9.data?.list || []).find((x) => x['文档编号'] === gNo)
  docNos.A2 = rowA2 ? (rowA2['单据编号'] || rowA2['编号']) : ''
  ok(!!docNos.A2, `⑨-1 立项申请 ${docNos.A2}(${gNo}) 已归档`)
  const t9 = await btn(api, 'RD_APPROVAL', '删除', { 编号: docNos.A2 })
  ok(t9.code !== 200 && String(t9.message || '').includes('仍被引用'), `⑨-2 被引用的立项申请作废被拒(${t9.message})`)
  await btn(api, 'RD_PLAN', '删除', { 编号: docNos.P2 })
  const t9c = await btn(api, 'RD_APPROVAL', '删除', { 编号: docNos.A2 })
  ok(t9c.code === 200, `⑨-3 先作废计划后立项申请可作废(${t9c?.data?.['单据状态']})`)

  // ⑩ 清理(计划/立项申请已处理;作废其余探针单据)
  for (const n of [docNos.D1, docNos.D2, docNos.D3, docNos.D4, docNos.D5]) {
    if (n) await btn(api, 'RD_DOM_TEST', '删除', { 编号: n })
  }
  // ⑧ 的计划与立项草稿
  await btn(api, 'RD_PLAN', '删除', { 编号: docNos.P1 })
  if (docNos.A1 === undefined) { /* A1 草稿在下面按文档编号找 */ }
  const qA1 = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_APPROVAL', pageNo: 1, pageSize: 200 }) })
  const rowA1 = ((qA1.data?.rows) || qA1.data?.list || []).find((x) => x['文档编号'] === aNo)
  if (rowA1) await btn(api, 'RD_APPROVAL', '删除', { 编号: rowA1['单据编号'] || rowA1['编号'] })

  fs.writeFileSync(__dirname + '/_probe-perm-docs.json', JSON.stringify({ MARK, ...docNos }, null, 2))
  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
