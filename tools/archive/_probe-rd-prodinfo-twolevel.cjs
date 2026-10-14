/**
 * _probe-rd-prodinfo-twolevel.cjs —— 产品信息表(RD_PROD_INFO)两级审批验收(2026-10-13)
 *
 * 背景(用户报障):「产品信息表是管理员一级审批之后选择二级审批人来审批之后才分发责任人的,
 *   现在我新增的单据管理员审批就直接归档了,这个应该是处于待二级审批,二级签核之后才归档然后分发责任人」。
 * 根因:管理员「保存」走 save() 里的"保存即归档"自审自批捷径,整条两级审批被跳过
 *   (实测 PI-2026-10-0013 留痕意见=「保存即归档（管理员保存）」)。用户裁定**只改产品信息表**。
 *
 * 本探针验的就是改后这一条链:
 *   管理员保存 → 审批中(★不再是已归档) → 一级审批不带二级审核人必须被拒 → 带了转「待二级审批」
 *   → 二级审核人签核 → 已归档 → 「分发责任人」才可用。
 * 顺带验「默认值键名」修复:用 label「审核人（一级审批人）」提交,必须能落库
 *   (改前 docDefaults 用物理列名「审核人一级」,后端 labelsToCols 按 label 取 ⇒ 静默丢弃、恒 NULL)。
 *
 * 账套:YJ_TEST(硬断言)。只造 1 张单,末尾写清理脚本。
 * 用法:node tools/archive/_probe-rd-prodinfo-twolevel.cjs
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const API = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const CLEANUP = path.join(__dirname, '_probe-rd-prodinfo-twolevel-cleanup.sql')

const CELLS = []
let PASS = 0, FAIL = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { FAIL++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
function check(id, expect, cond, actual, evidence) {
  const st = cond ? 'PASS' : 'FAIL'
  if (cond) PASS++; else { FAIL++ }
  CELLS.push({ id, st, expect, actual })
  console.log(`  [${st}] ${id}\n        期望: ${expect}\n        实际: ${actual}${evidence ? '\n        证据: ' + evidence : ''}`)
  return cond
}

const TOK = {}
async function login(u) {
  const r = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: u, password: '123456', factory: FACTORY }),
  })).json()
  if (r?.code !== 200) throw new Error('登录失败 ' + u + ': ' + JSON.stringify(r).slice(0, 200))
  if (r.data.user?.factory !== FACTORY) {
    console.error(`[ABORT] 账套 factory=${r.data.user?.factory}(期望 ${FACTORY})`)
    process.exit(2)
  }
  TOK[u] = { token: r.data.token, realName: r.data.user.realName, isAdmin: r.data.user.isAdmin }
  return TOK[u]
}
async function call(u, panelCode, buttonName, formData) {
  const r = await fetch(`${API}/px/callButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOK[u].token}` },
    body: JSON.stringify({ panelCode, buttonName, formData: formData || {}, buttonParam: {} }),
  })
  const t = await r.text()
  let j = null; try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { http: r.status, code: j?.code, msg: j?.message ?? j?.msg ?? t.slice(0, 200), data: j?.data }
}
const show = (r) => `HTTP=${r.http} code=${r.code} message=「${r.msg}」`
async function fieldOf(u, panelCode, no, key) {
  const r = await fetch(`${API}/px/getFormDescriptor?panelCode=${encodeURIComponent(panelCode)}&code=${encodeURIComponent(no)}`,
    { headers: { Authorization: `Bearer ${TOK[u].token}` } })
  const j = await r.json()
  const v = j?.data?.data?.[key]
  return v == null ? '' : String(v)
}

const TAG = 'PROBE2L' + Date.now().toString(36).toUpperCase()
const today = new Date().toISOString().slice(0, 10)

async function main() {
  console.log(`\n=== 产品信息表两级审批验收(账套 ${FACTORY}) TAG=${TAG} ===`)
  const admin = await login('admin')
  const cp = await login('cp')
  const other = await login('glm53')
  console.log(`  admin=${admin.realName}(isAdmin=${admin.isAdmin})  cp=${cp.realName}(isAdmin=${cp.isAdmin})  glm53=${other.realName}(isAdmin=${other.isAdmin})`)

  // ① 建草稿
  step('① 管理员新建产品信息表草稿')
  const rDraft = await call('admin', 'RD_PROD_INFO', '保存为草稿', {})
  const no = rDraft.data?.['编号']
  check('1-draft', 'code=200 且返回编号', rDraft.code === 200 && !!no, `${show(rDraft)} 编号=${no || '(无)'}`)
  if (!no) throw new Error('建草稿失败,后续无法验证')

  // ② ★ 核心:管理员「保存」后应当是「审批中」,而不是「已归档」
  step('② ★ 管理员「保存」不再直接归档(改前这里是「已归档」)')
  const rSave = await call('admin', 'RD_PROD_INFO', '保存', {
    编号: no, 单据日期: today, 产品编号: `${TAG}-P1`, 备注: TAG,
    // 默认值用 label 提交 —— 改前 docDefaults 用物理列名,这里就是它落不了库的那两格
    '审核人（一级审批人）': '冯总', '审核人（二级审批人）': '秀丽',
  })
  const st1 = rSave.data?.['单据状态']
  check('2-save-status', '管理员保存后状态 =「审批中」(两级审批起步,不再跳过)',
    rSave.code === 200 && st1 === '审批中', `${show(rSave)} 返回状态=「${st1}」`,
    'ButtonService.save(): ADMIN_SAVE_DEFERS_TO_FLOW 命中 RD_PROD_INFO ⇒ 走送审分支')

  // ③ 默认值两格(lable 键)必须落库
  step('③ 默认值键名修复:label 键必须能落库(改前用列名 ⇒ 恒 NULL)')
  const l1 = await fieldOf('admin', 'RD_PROD_INFO', no, '审核人（一级审批人）')
  const l2f = await fieldOf('admin', 'RD_PROD_INFO', no, '审核人（二级审批人）')
  check('3a-default-l1', '「审核人（一级审批人）」落库 = 冯总', l1 === '冯总', `落库=「${l1}」`, 'docDefaults.js 键改为 label')
  check('3b-default-l2', '「审核人（二级审批人）」落库 = 秀丽', l2f === '秀丽', `落库=「${l2f}」`, '同上')

  // ④ 一级审批不选二级审核人 → 必须被拒
  step('④ 一级审批不带二级审核人 → 必须被拒')
  const rNoL2 = await call('admin', 'RD_PROD_INFO', '审批通过', { 编号: no })
  check('4-l1-requires-l2', '拒绝:一级审批通过前必须选取二级审核人',
    rNoL2.code !== 200 && String(rNoL2.msg).includes('必须选取二级审核人'), show(rNoL2),
    'ButtonService.java 一级分支 l2.isEmpty() 守卫')

  // ⑤ 一级审批带二级审核人 → 待二级审批
  step('⑤ 一级审批选二级审核人 = cp → 状态「待二级审批」')
  const rL1 = await call('admin', 'RD_PROD_INFO', '审批通过', { 编号: no, 二级审批人: 'cp' })
  const st2 = rL1.data?.['单据状态']
  check('5-l1-to-l2pending', '状态 =「待二级审批」(不归档)',
    rL1.code === 200 && st2 === '待二级审批', `${show(rL1)} 返回状态=「${st2}」`,
    'approveApproval 一级分支 fixedAdminL2=false ⇒ 转待二级审批')

  // ⑥ 非被选定的二级审核人 不能签核
  step('⑥ 非被选定人不能完成二级审批')
  const rOther = await call('glm53', 'RD_PROD_INFO', '审批通过', { 编号: no })
  check('6-not-l2-denied', '非被选定二级审核人 → 被拒(权限门禁或"仅被选定的二级审核人"门禁,两者都算拒)',
    rOther.code !== 200, show(rOther), '二级节点 = 被选定的二级审核人 ∪ 管理员')

  // ⑦ 二级审核人 cp 签核 → 归档
  step('⑦ 二级审核人 cp 签核 → 已归档')
  const rL2 = await call('cp', 'RD_PROD_INFO', '审批通过', { 编号: no })
  const st3 = rL2.data?.['单据状态']
  check('7-l2-archive', '状态 =「已归档」', rL2.code === 200 && st3 === '已归档',
    `${show(rL2)} 返回状态=「${st3}」`, 'approveApproval 二级分支 → markArchived')

  // ⑧ 一级通过时会把选定的二级审核人姓名写回纸面;列表接口回读状态应为已归档
  step('⑧ 纸面写回 + 列表接口回读状态')
  const l2Written = await fieldOf('admin', 'RD_PROD_INFO', no, '审核人（二级审批人）')
  check('8a-l2-written-back', `一级通过把二级审核人写回纸面 = cp 的姓名「${cp.realName}」`,
    l2Written === cp.realName, `落库=「${l2Written}」`,
    'approveApproval 一级分支:选定的人写回「审核人（二级审批人）」格')

  const q = await fetch(`${API}/px/queryFormDataList`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOK['admin'].token}` },
    body: JSON.stringify({ panelCode: 'RD_PROD_INFO', condition: {}, pageNo: 1, pageSize: 50 }),
  }).then((r) => r.json())
  const row = (q?.data?.list || []).find((x) => String(x['单据编号']) === no)
  check('8b-list-status', '列表接口回读 单据状态 =「已归档」(「分发责任人」的前置条件之一)',
    !!row && String(row['单据状态']) === '已归档',
    row ? `单据状态=「${row['单据状态']}」` : `列表里找不到 ${no}(共 ${(q?.data?.list || []).length} 张)`,
    'ButtonService 「分发责任人」可用性 = 已归档 ∧ (二级审核人 ∪ 管理员)')

  console.log('\n════════ 汇总 ════════')
  console.log(`格子数=${CELLS.length}  PASS=${PASS}  FAIL=${FAIL}`)
  for (const c of CELLS.filter((x) => x.st === 'FAIL')) console.log(`  ✗ ${c.id}\n      期望: ${c.expect}\n      实际: ${c.actual}`)

  fs.writeFileSync(CLEANUP, `/* 清理:_probe-rd-prodinfo-twolevel.cjs 造出的产品信息表单据
   TAG=${TAG}  单号=${no}
   ⚠ 只对测试账套跑:sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d HSDZ_MES_TEST -C -f 65001 -i <本文件> */
SET NOCOUNT ON;
DECLARE @no nvarchar(120) = N'${no}';
SELECT N'[删除前] rd_prod_info_head' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM rd_prod_info_head WHERE 单据编号 = @no
UNION ALL SELECT N'[删除前] yj_doc_status', CAST(COUNT(*) AS nvarchar(10)) FROM yj_doc_status WHERE panel_code = N'RD_PROD_INFO' AND doc_no = @no
UNION ALL SELECT N'[删除前] yj_form_approval', CAST(COUNT(*) AS nvarchar(10)) FROM yj_form_approval WHERE panel_code = N'RD_PROD_INFO' AND form_no = @no
UNION ALL SELECT N'[删除前] yj_message', CAST(COUNT(*) AS nvarchar(10)) FROM yj_message WHERE 单据编号 = @no;
DELETE FROM yj_message       WHERE 单据编号 = @no;
DELETE FROM yj_form_approval WHERE panel_code = N'RD_PROD_INFO' AND form_no = @no;
IF OBJECT_ID('yj_doc_modify_log') IS NOT NULL DELETE FROM yj_doc_modify_log WHERE doc_no = @no;
DELETE FROM yj_doc_status    WHERE panel_code = N'RD_PROD_INFO' AND doc_no = @no;
IF OBJECT_ID('rd_prod_info_detail') IS NOT NULL DELETE FROM rd_prod_info_detail WHERE 单据编号 = @no;
DELETE FROM rd_prod_info_head WHERE 单据编号 = @no;
SELECT N'[删除后] 残留' AS 项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM rd_prod_info_head WHERE 单据编号 = @no;
`, 'utf8')
  console.log(`\n清理脚本: ${CLEANUP}(单号 ${no})`)
  process.exit(FAIL ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e && e.stack || e); process.exit(1) })
