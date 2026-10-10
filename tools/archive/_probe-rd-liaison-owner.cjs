/**
 * _probe-rd-liaison-owner.cjs —— 研发立项流程「审批并定级 → 分发对接人 → 确认责任人」全链路验收(2026-10-08)
 *
 * 用户口径(m01625 流程图的第③④步,逐句 = 本探针的断言清单):
 *   ③「定级完之后就要分发对接人,这个对接人可以自己选择是哪一个账号」
 *   ④「分发之后对应对接人账号可以进行签核然后分发下去,就是确认责任人,也可以选择账号,
 *      确认责任人之后就可以在项目实施计划里面进行对应单据的填写」
 *
 * 钉十二件事(全部走**接口**,不直接写库):
 *   ① 普通用户提交的立项申请,管理员「审批通过」带 项目等级 ⇒ 一次动作同时归档 + 定级(GRADE 留痕);
 *   ② /px/rdFlow/state 在定级后给出 canDispatchLiaison=true;
 *   ③ 未定级就分发对接人 ⇒ 被拒;
 *   ④ 无审批权账号(glm53)分发对接人 ⇒ 被拒(requireApprover);
 *   ⑤ 管理员分发对接人 = glm53 ⇒ rd_approval.备用1 落账号 + LIAISON 留痕 + glm53 收到 LIAISON_ASSIGNED 消息;
 *   ⑥ 非对接人(liulei)确认责任人 ⇒ 被拒;
 *   ⑦ 对接人(glm53)确认责任人 ⇒ rd_approval.备用2 落账号 + OWNER 留痕 + 责任人收到 OWNER_CONFIRMED 消息;
 *   ⑧ 联系人账号不存在/停用 ⇒ 被拒;
 *   ⑨ 下游:RD_PLAN 的「文档编号」refMap 含 项目责任人 → 负责人(否则负责人永远空,该格 editable=0);
 *   ⑩ 前端配置:RD_APPROVAL 的「对接人」「项目责任人」是 hidden=1 的隐藏字段(不进网格/表单,只由按钮写);
 *   ⑪ 反审核(弃审)把 备用1/备用2 一起清空(否则回草稿后跳过「分发对接人」这一步);
 *   ⑫ 绕过按钮直接保存(表单里塞 对接人/项目责任人)⇒ 服务端不收,值不变。
 *
 * 账套:默认 **测试账套**(factory=YJ_TEST)并断言令牌账套确实是 YJ_TEST —— 正式库绝不能被本探针碰到。
 * 用法:node tools/archive/_probe-rd-liaison-owner.cjs   (需 8090 在跑;跑完写清理 SQL,再手工执行)
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const BASE = process.env.YINJIA_API || 'http://127.0.0.1:8090'
const FACTORY = process.env.FACTORY || 'YJ_TEST'
const TAG = 'PROBE-LIAISON-' + Date.now().toString().slice(-6)
const CLEANUP = path.join(__dirname, '_probe-rd-liaison-owner-cleanup.sql')

const LIAISON = 'glm53'      // 对接人(要用他的令牌签核)
const OTHER = 'liulei'       // 非本单对接人(应被拒)
const OWNER = 'cp'           // 被确认的项目责任人

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)

async function login(userName) {
  const r = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password: '123456', factory: FACTORY }),
  })).json()
  if (!r?.data?.token) throw new Error(`${userName} 登录失败:${JSON.stringify(r).slice(0, 200)}`)
  if (r.data.user?.factory !== FACTORY) {
    throw new Error(`令牌账套不是 ${FACTORY}(实为 ${r.data.user?.factory}),为避免污染正式库已中止`)
  }
  return { token: r.data.token, user: r.data.user }
}

function api(t) {
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${t}` }
  return {
    btn: async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
      method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
    })).json()),
    get: async (p) => (await (await fetch(BASE + p, { headers: H })).json()),
  }
}

async function main() {
  console.log(`\n=== 研发立项流程:审批并定级 → 分发对接人 → 确认责任人(账套 ${FACTORY})===`)

  const admin = await login('admin')
  const glm = await login(LIAISON)
  const liu = await login(OTHER)
  const own = await login(OWNER)
  const A = api(admin.token)
  const G = api(glm.token)
  const L = api(liu.token)
  const O = api(own.token)
  ok(`登录成功(admin / ${LIAISON} / ${OTHER} / ${OWNER},账套均为 ${FACTORY})`)

  // 取字段元数据(顺带验证 ⑩:两新字段是隐藏字段)
  const cfg = await A.get('/api/px/getPanelConfig?panelCode=RD_APPROVAL')
  const heads = cfg?.data?.dataSchema?.fields || []
  const fLiaison = heads.find((f) => (f.dataName || f.code) === '对接人')
  const fOwner = heads.find((f) => (f.dataName || f.code) === '项目责任人')
  step('⑩ 新字段登记为隐藏只读(不进表单/网格,只能由按钮写)')
  if (fLiaison && fLiaison.hidden === true && fLiaison.readonly === true) ok('对接人 = hidden + readonly')
  else bad(`对接人 字段规格不符:${JSON.stringify(fLiaison)}`)
  if (fOwner && fOwner.hidden === true && fOwner.readonly === true) ok('项目责任人 = hidden + readonly')
  else bad(`项目责任人 字段规格不符:${JSON.stringify(fOwner)}`)

  // ════ ① 普通用户建单 → 管理员审批通过(带等级) ════
  // 两次调用才等于界面上的「新增 + 填写 + 保存」:
  //   · 「保存为草稿」不带编号/不带明细 ⇒ saveDoc 走**空草稿早返回**(ButtonService.java:331-366,只建占位单);
  //   · 带编号再按「保存」(markSaved=true)才进状态机,普通用户在此被置 pending='Y'(即送审)。
  // 「提交审批」是审批权按钮,普通用户按会被 403,这里刻意不用。
  step('① 普通用户建单并按「保存」提交 → 管理员「审批通过」带 项目等级(审批与定级同一步)')
  const blank = await G.btn('RD_APPROVAL', '保存为草稿', {})
  const no = blank?.data?.['编号']
  if (!no) throw new Error('建立项申请失败:' + JSON.stringify(blank).slice(0, 300))
  const submitted = await G.btn('RD_APPROVAL', '保存', {
    编号: no, 文档编号: TAG, 申请立项人: glm.user.realName || LIAISON,
    项目开发目标: '探针-立项流程对接人/责任人验收',
  })
  const st0pre = (await A.get(`/api/px/rdFlow/state?docNo=${encodeURIComponent(no)}`))?.data || {}
  console.log(`     保存后:单号=${no} code=${submitted?.code} ${submitted?.message || ''} 状态=${st0pre.status}`)
  if (st0pre.status === '审批中') ok('普通用户「保存」即送审(状态 = 审批中,待管理员审批)')
  else bad(`普通用户保存后状态应为审批中,实为 ${st0pre.status}`)

  const early = await A.btn('RD_APPROVAL', '分发对接人', { 编号: no, 对接人: LIAISON })
  if (early?.code !== 200) ok(`未定级/未归档时分发被拒:${early.message}`)
  else bad('未定级就该拒绝分发对接人,却被接受了')

  const granted = await A.btn('RD_APPROVAL', '审批通过', { 编号: no, 项目等级: '二级', 审批意见: '探针:审批并定级' })
  console.log(`     审批通过:code=${granted?.code} ${granted?.message || ''} ${JSON.stringify(granted?.data || {})}`)
  const desc = await A.get(`/api/px/getFormDescriptor?panelCode=RD_APPROVAL&code=${encodeURIComponent(no)}`)
  const d = desc?.data?.data || {}
  const status = d['单据状态']
  if (d['项目等级'] === '二级') ok('rd_approval.项目等级 = 二级(与审批同一步落库)')
  else bad(`等级未随审批落库:${JSON.stringify(d['项目等级'])}`)
  if (status === '已归档' || status === '已审核') ok(`单据状态 = ${status}`)
  else bad(`单据状态不符:${status}`)
  const hist1 = (await A.btn('RD_APPROVAL', '审批情况', { 编号: no }))?.data?.list || []
  if (hist1.some((x) => x.action === 'GRADE')) ok(`留痕含 GRADE:${hist1.filter((x) => x.action === 'GRADE').map((x) => x.opinion).join(' | ')}`)
  else bad(`缺 GRADE 留痕:${JSON.stringify(hist1.map((x) => x.action))}`)

  // ════ ② 状态端点 ════
  step('② /px/rdFlow/state 判定')
  const st0 = (await A.get(`/api/px/rdFlow/state?docNo=${encodeURIComponent(no)}`))?.data || {}
  console.log('     ' + JSON.stringify(st0))
  if (st0.canDispatchLiaison === true) ok('管理员可分发对接人(canDispatchLiaison=true)')
  else bad(`管理员应可分发给对接人:${JSON.stringify(st0)}`)
  if (st0.canConfirmOwner === false) ok('未分发对接人前 canConfirmOwner=false')
  else bad(`未分发就不该可确认责任人:${JSON.stringify(st0)}`)
  const stG = (await G.get(`/api/px/rdFlow/state?docNo=${encodeURIComponent(no)}`))?.data || {}
  if (stG.canDispatchLiaison === false) ok(`${LIAISON} 无审批权 ⇒ canDispatchLiaison=false`)
  else bad(`无审批权账号不该能分发:${JSON.stringify(stG)}`)

  // ════ ④ 无审批权账号分发被拒 ════
  step('④ 无审批权账号分发对接人被拒')
  const denied4 = await G.btn('RD_APPROVAL', '分发对接人', { 编号: no, 对接人: LIAISON })
  if (denied4?.code !== 200 && /权限/.test(String(denied4?.message))) ok(`被拒:${denied4.message}`)
  else bad(`无审批权账号不该能分发,实际 code=${denied4?.code} msg=${denied4?.message}`)

  // ════ ⑧ 账号校验 ════
  step('⑧ 联系人账号不存在/停用被拒')
  const ghost = await A.btn('RD_APPROVAL', '分发对接人', { 编号: no, 对接人: 'no_such_account' })
  if (ghost?.code !== 200 && /不存在|停用/.test(String(ghost?.message))) ok(`被拒:${ghost.message}`)
  else bad(`幽灵账号不该被接受:code=${ghost?.code} msg=${ghost?.message}`)

  // ════ ⑤ 分发对接人 ════  step(`⑤ 管理员分发对接人 = ${LIAISON}`)
  const dis = await A.btn('RD_APPROVAL', '分发对接人', { 编号: no, 对接人: LIAISON })
  console.log(`     code=${dis?.code} ${dis?.message || ''} ${JSON.stringify(dis?.data || {})}`)
  const msgs = (await G.get('/api/portal/message/list?onlyUnread=true&limit=200'))?.data || []
  const gotLiaison = msgs.filter((m) => m['消息码'] === 'LIAISON_ASSIGNED' && m['单据编号'] === no)
  if (gotLiaison.length === 1) ok(`${LIAISON} 收到 1 条 LIAISON_ASSIGNED 消息`)
  else bad(`LIAISON_ASSIGNED 消息数不符:${gotLiaison.length}(全部未读 ${msgs.length} 条)`)

  // ════ ⑥ 非对接人确认被拒 ════
  step(`⑥ 非本单对接人(${OTHER})确认责任人被拒`)
  const denied6 = await L.btn('RD_APPROVAL', '确认责任人', { 编号: no, 项目责任人: OWNER })
  if (denied6?.code !== 200 && /对接人|权限/.test(String(denied6?.message))) ok(`被拒:${denied6.message}`)
  else bad(`非对接人不该能确认责任人:code=${denied6?.code} msg=${denied6?.message}`)

  // ════ ⑦ 对接人确认责任人 ════
  step(`⑦ 对接人(${LIAISON})确认责任人 = ${OWNER}`)
  const stG2 = (await G.get(`/api/px/rdFlow/state?docNo=${encodeURIComponent(no)}`))?.data || {}
  if (stG2.canConfirmOwner === true) ok('对接人 canConfirmOwner=true')
  else bad(`对接人应可确认责任人:${JSON.stringify(stG2)}`)
  const conf = await G.btn('RD_APPROVAL', '确认责任人', { 编号: no, 项目责任人: OWNER })
  console.log(`     code=${conf?.code} ${conf?.message || ''} ${JSON.stringify(conf?.data || {})}`)
  // 消息收件人 = 被确认的责任人本人(cp),不能用 admin 的信箱去查
  const ownerMsgs = (await O.get('/api/portal/message/list?onlyUnread=true&limit=200'))?.data || []
  const gotOwner = ownerMsgs.filter((m) => m['消息码'] === 'OWNER_CONFIRMED' && m['单据编号'] === no)
  if (gotOwner.length === 1) ok(`${OWNER} 收到 1 条 OWNER_CONFIRMED 消息`)
  else bad(`OWNER_CONFIRMED 消息数不符:${gotOwner.length}(${OWNER} 未读 ${ownerMsgs.length} 条)`)
  const st1 = (await A.get(`/api/px/rdFlow/state?docNo=${encodeURIComponent(no)}`))?.data || {}
  if (st1.liaison === LIAISON && st1.owner === OWNER) ok(`状态端点回读:对接人=${st1.liaison} 责任人=${st1.owner}(${st1.ownerName})`)
  else bad(`状态端点回读不符:${JSON.stringify(st1)}`)

  // ════ ⑫ 绕过按钮直接保存不收这两格 ════
  step('⑫ 表单直接塞 对接人/项目责任人 ⇒ 服务端不收')
  await A.btn('RD_APPROVAL', '保存', { 编号: no, 文档编号: TAG, 对接人: 'admin', 项目责任人: 'admin' })
  const st2 = (await A.get(`/api/px/rdFlow/state?docNo=${encodeURIComponent(no)}`))?.data || {}
  if (st2.liaison === LIAISON && st2.owner === OWNER) ok('两格未被表单改写(save 里已 remove)')
  else bad(`表单绕过了按钮门禁:${JSON.stringify({ liaison: st2.liaison, owner: st2.owner })}`)

  // ════ ⑨ 下游参照映射 ════
  step('⑨ 下游:RD_PLAN 的「文档编号」refMap 含 项目责任人 → 负责人')
  const planCfg = await A.get('/api/px/getPanelConfig?panelCode=RD_PLAN')
  const planHeads = planCfg?.data?.dataSchema?.fields || []
  const refDoc = planHeads.find((f) => (f.dataName || f.code) === '文档编号')
  const map = refDoc?.refMap || []
  console.log(`     文档编号.refMap = ${JSON.stringify(map)}`)
  if (map.some((m) => m.from === '项目责任人' && m.to === '负责人')) ok('映射在:项目责任人 → 负责人(选中本单即带入计划负责人)')
  else bad(`缺少 项目责任人→负责人 映射:${JSON.stringify(map)}`)
  const ownerField = planHeads.find((f) => (f.dataName || f.code) === '负责人')
  if (ownerField && ownerField.readonly === true) ok('RD_PLAN.负责人 仍是只读格(只能靠参照带入,符合设计)')
  else bad(`RD_PLAN.负责人 规格不符:${JSON.stringify(ownerField)}`)

  // ════ ⑪ 弃审清空两格 ════
  step('⑪ 反审核把 对接人/项目责任人 一起清空')
  const un = await A.btn('RD_APPROVAL', '弃审', { 编号: no })
  console.log(`     弃审:code=${un?.code} ${un?.message || ''}`)
  const st3 = (await A.get(`/api/px/rdFlow/state?docNo=${encodeURIComponent(no)}`))?.data || {}
  if (!st3.liaison && !st3.owner) ok('两格已清空(回草稿后必须重新分发对接人)')
  else bad(`弃审后仍挂着人:${JSON.stringify({ liaison: st3.liaison, owner: st3.owner })}`)

  fs.writeFileSync(CLEANUP, `/* 探针清理:立项流程 对接人/责任人 验收(_probe-rd-liaison-owner.cjs) */
USE HSDZ_MES_TEST; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_approval WHERE 文档编号 = N'${TAG}';
DELETE FROM yj_message            WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval      WHERE panel_code = N'RD_APPROVAL' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_modify_log     WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status         WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM rd_approval_detail    WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_approval           WHERE 单据编号 IN (SELECT no FROM @docs);
SELECT N'立项申请残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_approval WHERE 文档编号 = N'${TAG}';
`, 'utf8')
  console.log(`\n  --   清理 SQL:${CLEANUP}(单号 ${no} / 文档编号 ${TAG})`)
  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
