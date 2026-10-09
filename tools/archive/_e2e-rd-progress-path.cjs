/* 研发立项 → 项目进度查询「一条路」端到端验证(2026-10-09)
 *
 * 目的(用户口径:「从立项申请写一个测试单据走一遍流程,走一条路就行进行测试」):
 *   走**一条**完整业务路径,并把「项目进度查询」重设计的落库值逐格验到底:
 *     立项申请建单 → 普通用户保存(送审) → 管理员审批通过并定级
 *     → 分发对接人 → 对接人确认项目责任人
 *     → 项目实施计划建单(文档编号**参照**该立项申请)→ 送审 → 审批通过归档
 *     → 断言 RD_PROGRESS 自动出现该行,且 项目定级/项目发起人/立项日期/内容/预计完成日期/… = 期望值
 *     → 弃审 → 改阶段内容 → 重新走流程归档 → 断言**覆盖**(同一行、不重复、值已更新)
 *
 * 关键关联事实(本探针存在的理由):
 *   yj_field: RD_PLAN.文档编号 = 参照 RD_APPROVAL.文档编号(ref_panel=RD_APPROVAL,
 *   ref_filter=单据状态=已归档)。所以 **RD_PLAN.文档编号 === RD_APPROVAL.文档编号** 是设计好的关联键,
 *   ButtonService.syncPlanToProgress 的三段子查询(appr_level / appr_initiator / appr_archived_at)
 *   正是按 `a.[文档编号] = p.[文档编号]` 关联 —— 之前矩阵探针(J 组)给 RD_PLAN 随手编了个
 *   文档编号,所以那三格恒为空,看不出链路通没通。本探针按真实关联取值。
 *
 * 硬性约束(勿改):
 *   · FACTORY 只能是测试账套 YJ_TEST;每次登录后断言 JWT 里的 factory,不符 exit 2;
 *   · 不重启服务、不改任何已跟踪源码。
 *
 * 用法: node tools/archive/_e2e-rd-progress-path.cjs
 * 产物: stdout 逐格 PASS/FAIL + 末尾生成清理脚本 _e2e-rd-progress-path-cleanup.sql
 */
const fs = require('fs')
const path = require('path')

const API = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'                 // ← 账套键(DataSourceRouter.TEST),不是数据库名 HSDZ_MES_TEST!
const LEDGER_DB = 'HSDZ_MES_TEST'        // ← 该账套对应的库(仅用于文档与清理 SQL 说明)
const CLEANUP_SQL = path.join(__dirname, '_e2e-rd-progress-path-cleanup.sql')

if (FACTORY !== 'YJ_TEST') {
  console.error(`[ABORT] FACTORY=${FACTORY} 不是测试账套键 —— 正式库 HSDZ_MES 只录真实业务,拒绝造数`)
  process.exit(2)
}

// ───────── 采集器 ─────────
const CELLS = []
const CREATED = []               // {panel, no, note}
let PASS = 0, FAIL = 0

function check(id, expect, ok, actual, evidence) {
  const state = ok ? 'PASS' : 'FAIL'
  if (ok) PASS++; else FAIL++
  CELLS.push({ id, expect, state, actual, evidence: evidence || '' })
  console.log(`[${state}] ${id}`)
  console.log(`       期望: ${expect}`)
  console.log(`       实际: ${actual}`)
  if (evidence) console.log(`       证据: ${evidence}`)
  return state
}

function track(panel, no, note) { if (no) CREATED.push({ panel, no, note }) }

// ───────── HTTP ─────────
const TOKENS = {}

async function login(userName) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password: '123456', factory: FACTORY }),
  })
  const j = await r.json()
  if (j?.code !== 200) throw new Error(`登录失败 ${userName}: ${JSON.stringify(j)}`)
  const got = j.data?.user?.factory
  if (got !== FACTORY) {
    console.error(`[ABORT] 登录 ${userName} 返回账套 factory=${JSON.stringify(got)}(期望 ${FACTORY})`)
    console.error('        路由会落到正式库 HSDZ_MES —— 已中止,未做任何写操作。')
    process.exit(2)
  }
  TOKENS[userName] = { token: j.data.token, realName: j.data.user.realName, isAdmin: j.data.user.isAdmin }
  return TOKENS[userName]
}
const T = (u) => TOKENS[u].token
const nameOf = (u) => TOKENS[u].realName

async function call(user, panelCode, buttonName, formData, buttonParam) {
  const r = await fetch(`${API}/px/callButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T(user)}` },
    body: JSON.stringify({ panelCode, buttonName, formData: formData || {}, buttonParam: buttonParam || {} }),
  })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch { /* 非 JSON */ }
  return { http: r.status, code: j?.code, msg: j?.message ?? j?.msg ?? text.slice(0, 200), data: j?.data }
}
const show = (r) => `HTTP=${r.http} code=${r.code} message=「${r.msg}」`

async function fieldOf(user, panelCode, no, key) {
  const r = await fetch(`${API}/px/getFormDescriptor?panelCode=${encodeURIComponent(panelCode)}&code=${encodeURIComponent(no)}`,
    { headers: { Authorization: `Bearer ${T(user)}` } })
  const j = await r.json()
  const v = j?.data?.data?.[key]
  return v == null ? '' : String(v)
}

/** 取项目进度查询里 项目编号=planDocCode 的明细行(标签键口径;后端 rowToLabels 以 yj_field.label 输出) */
async function progressRow(user, planDocCode) {
  const r = await fetch(`${API}/px/queryFormDataList`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T(user)}` },
    body: JSON.stringify({ panelCode: 'RD_PROGRESS', condition: {}, pageNo: 1, pageSize: 50 }),
  })
  const j = await r.json()
  const docs = j?.data?.list || []
  const all = docs.flatMap((d) => (d.detail?.items || []).map((it) => ({ doc: d['单据编号'], it })))
  return { hit: all.filter((x) => String(x.it['项目编号'] || '') === planDocCode), all }
}

// ───────── 造数 ─────────
const TAG = 'E2E' + Date.now().toString(36).toUpperCase()
const today = new Date().toISOString().slice(0, 10)

async function main() {
  console.log('=== 研发立项 → 项目进度查询:单路径端到端 ===')
  console.log(`TAG=${TAG}  账套键 factory=${FACTORY}(→ 库 ${LEDGER_DB})  API=${API}`)
  console.log('')

  for (const u of ['glm53', 'cp', 'admin']) {
    const d = await login(u)
    console.log(`  登录 ${u} → ${d.realName} isAdmin=${d.isAdmin} factory=YJ_TEST(已断言)`)
  }
  console.log('')

  // ───────────────── ① 立项申请 ─────────────────
  console.log('──────── ① 立项申请:建单 → 送审 → 审批通过并定级 → 分发 → 确认责任人 ────────')
  const rDraft = await call('glm53', 'RD_APPROVAL', '保存为草稿', {})
  const apprNo = rDraft.data?.['编号']
  track('RD_APPROVAL', apprNo, 'E2E 立项申请')
  check('E1-approval-draft', '普通用户可建空白草稿 → code=200 且返回编号',
    rDraft.code === 200 && !!apprNo, `${show(rDraft)} 编号=${apprNo || '(无)'}`,
    'ButtonService.java:113 case 新增/保存为草稿')

  const APPROVAL_DOC_NO = `${TAG}-DOC`          // ← 立项申请的文档编号 = 后面实施计划的参照值
  const SPEC = `${TAG}-滤芯规格`                 // ← 立项申请的「滤芯/炭棒规格或结构」→ 进度表「子项目/尺寸」
  const rSave = await call('glm53', 'RD_APPROVAL', '保存', {
    编号: apprNo, 单据日期: today, 文档编号: APPROVAL_DOC_NO, 客户名: TAG,
    '滤芯/炭棒规格或结构': SPEC, 申请立项人: '(伪造值,应被操作人覆盖)',
  })
  check('E2-approval-submit', '普通用户「保存」= 自动送审 → 状态=审批中',
    rSave.code === 200 && rSave.data?.['单据状态'] === '审批中',
    `${show(rSave)} 返回状态=${rSave.data?.['单据状态']}`,
    'ButtonService.java:482-496 普通用户分支 pending=Y')

  const initiator = await fieldOf('admin', 'RD_APPROVAL', apprNo, '申请立项人')
  check('E3-initiator', `申请立项人 = 提交审批的人「${nameOf('glm53')}」(不是伪造值)`,
    initiator === nameOf('glm53'), `落库 申请立项人=「${initiator}」`, 'ButtonService.java:1518-1529')

  const rApprove = await call('admin', 'RD_APPROVAL', '审批通过', { 编号: apprNo, 项目等级: '三级' })
  check('E4-approve-grade', '管理员审批通过并定级三级 → 状态=已归档、项目等级=三级',
    rApprove.code === 200 && rApprove.data?.['单据状态'] === '已归档',
    `${show(rApprove)} 返回状态=${rApprove.data?.['单据状态']}`,
    'ButtonService.java:1618-1664 审批通过即归档')
  const lvl = await fieldOf('admin', 'RD_APPROVAL', apprNo, '项目等级')
  check('E5-grade-persist', '项目等级落库 = 三级(该值将带入项目进度查询)',
    lvl === '三级', `落库 项目等级=「${lvl}」`, '同上报数')

  const rDispatch = await call('admin', 'RD_APPROVAL', '分发对接人', { 编号: apprNo, 对接人: 'cp' })
  check('E6-dispatch', '分发对接人 = cp(只能一次)',
    rDispatch.code === 200 && (await fieldOf('admin', 'RD_APPROVAL', apprNo, '对接人')) === 'cp',
    `${show(rDispatch)} 落库 对接人=「${await fieldOf('admin', 'RD_APPROVAL', apprNo, '对接人')}」`,
    'ButtonService.java:4024-4055')

  const rOwner = await call('cp', 'RD_APPROVAL', '确认责任人', { 编号: apprNo, 项目责任人: 'cp' })
  check('E7-owner', '对接人本人确认项目责任人 = cp',
    rOwner.code === 200 && (await fieldOf('admin', 'RD_APPROVAL', apprNo, '项目责任人')) === 'cp',
    `${show(rOwner)} 落库 项目责任人=「${await fieldOf('admin', 'RD_APPROVAL', apprNo, '项目责任人')}」`,
    'ButtonService.java:4075-4088')

  // ───────────────── ② 项目实施计划 ─────────────────
  console.log('\n──────── ② 项目实施计划:文档编号参照该立项申请 → 送审 → 审批通过归档 ────────')
  const rPlanDraft = await call('glm53', 'RD_PLAN', '保存为草稿', {})
  const planNo = rPlanDraft.data?.['编号']
  track('RD_PLAN', planNo, 'E2E 项目实施计划')
  check('E8-plan-draft', '建实施计划空白草稿 → code=200 且返回编号',
    rPlanDraft.code === 200 && !!planNo, `${show(rPlanDraft)} 编号=${planNo || '(无)'}`, '同 E1')

  const PROJECT_NAME = `${TAG}-项目A`
  const planFields = (content1) => ({
    编号: planNo, 单据日期: today,
    项目名称: PROJECT_NAME,
    项目定级: '二级',                       // ← 故意与立项申请的「三级」不同:验证等级取自**立项申请**
    文档编号: APPROVAL_DOC_NO,              // ← 参照键:必须等于立项申请的文档编号
    负责人: 'cp',
    阶段1_计划内容: content1, 阶段1_计划完成: '2026-10-20',
    阶段2_计划内容: '样品试制', 阶段2_计划完成: '2026-11-10',
  })
  const rPlanSave = await call('glm53', 'RD_PLAN', '保存', planFields('方案确认'))
  check('E9-plan-submit', '实施计划普通用户「保存」= 送审 → 状态=审批中',
    rPlanSave.code === 200 && rPlanSave.data?.['单据状态'] === '审批中',
    `${show(rPlanSave)} 返回状态=${rPlanSave.data?.['单据状态']}`, '同一口径')
  const planDocNoSaved = await fieldOf('admin', 'RD_PLAN', planNo, '文档编号')
  check('E10-plan-refkey', `实施计划的文档编号 = 立项申请的文档编号「${APPROVAL_DOC_NO}」(关联键成立)`,
    planDocNoSaved === APPROVAL_DOC_NO, `落库 文档编号=「${planDocNoSaved}」`,
    'yj_field: RD_PLAN.文档编号 ref_panel=RD_APPROVAL/ref_field=文档编号/ref_filter=单据状态=已归档')

  const rPlanApprove = await call('admin', 'RD_PLAN', '审批通过', { 编号: planNo })
  check('E11-plan-archive', '管理员审批通过 → 归档(触发自动同步)',
    rPlanApprove.code === 200 && rPlanApprove.data?.['单据状态'] === '已归档',
    `${show(rPlanApprove)} 返回状态=${rPlanApprove.data?.['单据状态']}`,
    'ButtonService.java:1720-1727 approveApproval → markArchived 后 syncAllPlansToProgress()')

  // ───────────────── ③ 项目进度查询落库值 ─────────────────
  console.log('\n──────── ③ 项目进度查询:自动导入行 + 逐字段落库值 ────────')
  const { hit, all } = await progressRow('admin', APPROVAL_DOC_NO)
  check('E12-progress-row', `进度查询出现 项目编号=${APPROVAL_DOC_NO} 的行`,
    hit.length === 1,
    hit.length === 1 ? `命中 1 行(单据 ${hit[0].doc})` : `命中 ${hit.length} 行;库中现有项目编号=${JSON.stringify(all.map((x) => x.it['项目编号']))}`,
    'syncPlanToProgress: 说明/项目编号 = RD_PLAN.文档编号')

  const it = hit[0]?.it || {}
  const archivedAt = await (async () => {
    // 立项申请的归档时刻(进度表「立项日期」取它的前 19 位)
    const r = await fetch(`${API}/px/getFormDescriptor?panelCode=RD_APPROVAL&code=${encodeURIComponent(apprNo)}`,
      { headers: { Authorization: `Bearer ${T('admin')}` } })
    const j = await r.json()
    return String(j?.data?.docStatus?.archived_at || j?.data?.data?.['归档时间'] || '')
  })()

  const eq = (k, want) => String(it[k] ?? '') === String(want)
  check('E13-level', '「项目定级」= 立项申请的三级(不是实施计划自己填的二级)',
    eq('项目定级', '三级'), `进度行 项目定级=「${it['项目定级'] ?? ''}」`,
    'syncPlanToProgress: level = appr_level(rd_approval.项目等级) ?? plan.项目定级')
  check('E14-initiator', `「项目发起人」= 立项申请的申请立项人「${nameOf('glm53')}」`,
    eq('项目级', nameOf('glm53')), `进度行 项目级=「${it['项目级'] ?? ''}」`,
    'syncPlanToProgress: initiator = appr_initiator(rd_approval.申请立项人) → [项目级]')
  check('E15-content', '「内容」= 10 个阶段拼接「阶段1：方案确认；阶段2：样品试制」',
    eq('内容', '阶段1：方案确认；阶段2：样品试制'), `进度行 内容=「${it['内容'] ?? ''}」`,
    'ButtonService.java:3670-3676 contentBuf 拼接')
  check('E16-due', '「预计完成日期」= 最晚阶段计划完成 2026-11-10',
    eq('里程完成', '2026-11-10'), `进度行 里程完成=「${it['里程完成'] ?? ''}」`,
    'lastPlanDue:阶段号递增取最后一个')
  check('E17-owner', '「项目负责人」= 实施计划负责人 cp',
    eq('项目负责', 'cp'), `进度行 项目负责=「${it['项目负责'] ?? ''}」`, 'plan.负责人')
  check('E18-spec', `「子项目/尺寸」= 立项申请的滤芯规格「${SPEC}」`,
    eq('子项目/尺寸', SPEC), `进度行 子项目/尺寸=「${it['子项目/尺寸'] ?? ''}」`,
    'specFromApproval(planDocNo) → rd_approval.滤芯炭棒规格或结构')
  check('E19-status', '「状态」= 阶段已规划(2个)(两个阶段都无实际完成)',
    eq('状态', '阶段已规划(2个)'), `进度行 状态=「${it['状态'] ?? ''}」`,
    'ButtonService.java:3686-3690')
  // 立项日期 = 立项申请归档日期;探针拿不到 archived_at 时只校验"非空 + 形如日期"
  const startOk = /^\d{4}-\d{2}-\d{2}/.test(String(it['实施进度'] ?? ''))
  check('E20-startdate', '「立项日期」非空且形如 YYYY-MM-DD…(= 立项申请归档日期)',
    startOk, `进度行 实施进度=「${it['实施进度'] ?? ''}」 归档时刻回读=「${archivedAt || '(接口未回读)'}」`,
    'appr_archived_at = yj_doc_status.archived_at(RD_APPROVAL), CONVERT 120')

  // ───────────────── ④ 弃审 → 改内容 → 重走 → 归档 → 覆盖 ─────────────────
  console.log('\n──────── ④ 弃审改内容后重新归档:进度行应被**覆盖**,不新增第二行 ────────')
  const rUnaudit = await call('admin', 'RD_PLAN', '弃审', { 编号: planNo })
  check('E21-unaudit', '实施计划弃审(已归档 → 草稿)',
    rUnaudit.code === 200 && rUnaudit.data?.['单据状态'] === '草稿',
    `${show(rUnaudit)} 返回状态=${rUnaudit.data?.['单据状态']}`, 'ButtonService.java:1362-1448')

  const rEdit = await call('glm53', 'RD_PLAN', '保存', planFields('方案确认(已修订)'))
  check('E22-resubmit', '改阶段1内容后重新保存 = 送审',
    rEdit.code === 200 && rEdit.data?.['单据状态'] === '审批中',
    `${show(rEdit)} 返回状态=${rEdit.data?.['单据状态']}`, '同一口径')
  const rRe = await call('admin', 'RD_PLAN', '审批通过', { 编号: planNo })
  check('E23-rearchive', '再次审批通过 → 归档', rRe.code === 200 && rRe.data?.['单据状态'] === '已归档',
    `${show(rRe)} 返回状态=${rRe.data?.['单据状态']}`, '同 E11')

  const after = await progressRow('admin', APPROVAL_DOC_NO)
  check('E24-no-dup', '进度查询里该 项目编号 仍只有 1 行(覆盖而非追加)',
    after.hit.length === 1, `命中 ${after.hit.length} 行`,
    'UPDATE 命中条件 [单据编号]+[项目名称]+[说明]')
  const it2 = after.hit[0]?.it || {}
  check('E25-overwrite', '「内容」已被覆盖为「阶段1：方案确认(已修订)；阶段2：样品试制」',
    String(it2['内容'] ?? '') === '阶段1：方案确认(已修订)；阶段2：样品试制',
    `覆盖后 内容=「${it2['内容'] ?? ''}」`, 'COALESCE(?, 原值) 传新值即覆盖')
  check('E26-keep', '其余列未被清空(项目级/项目负责/里程完成 保持)',
    String(it2['项目级'] ?? '') === nameOf('glm53') && String(it2['项目负责'] ?? '') === 'cp'
      && String(it2['里程完成'] ?? '') === '2026-11-10',
    `项目级=「${it2['项目级'] ?? ''}」 项目负责=「${it2['项目负责'] ?? ''}」 里程完成=「${it2['里程完成'] ?? ''}」`,
    '重复归档幂等:同值重写,不清空')

  // ───────────────── 汇总 ─────────────────
  console.log('\n════════════════ 汇总 ════════════════')
  console.log(`格子数=${CELLS.length}  PASS=${PASS}  FAIL=${FAIL}`)
  for (const c of CELLS.filter((x) => x.state === 'FAIL')) {
    console.log(`  ✗ ${c.id}`)
    console.log(`      期望: ${c.expect}`)
    console.log(`      实际: ${c.actual}`)
  }

  // 清理脚本
  const values = CREATED.length ? CREATED.map((c) => `(N'${c.no}')`).join(',') : "(N'__none__')"
  const sql = `/* 清理:研发立项→项目进度查询 单路径端到端探针(_e2e-rd-progress-path.cjs)在测试账套造出的单据
   TAG=${TAG}  生成时间=${new Date().toISOString()}
   归属判据:① 本次运行显式登记的单据号;② 标记位 立项单 客户名='${TAG}' / 实施计划 项目名称 LIKE '${TAG}%'
   ⚠ 只对测试账套跑!账套键 YJ_TEST ↔ 库名 HSDZ_MES_TEST(两者不同,别混)。
   ⚠ DbSync 不显示 SELECT 结果,残留检查必须用 sqlcmd:
     sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d HSDZ_MES_TEST -i <本文件> -W -s"|" */
SET NOCOUNT ON;
DECLARE @tagPattern nvarchar(60) = N'${TAG}%';
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT v FROM (VALUES ${values}) AS t(v)
  WHERE v <> N'__none__' AND NOT EXISTS (SELECT 1 FROM @docs d WHERE d.no = t.v);
INSERT INTO @docs (no)
  SELECT x.no FROM (
    SELECT 单据编号 AS no FROM rd_approval WHERE 客户名 LIKE @tagPattern
    UNION SELECT 单据编号 FROM rd_plan WHERE 项目名称 LIKE @tagPattern
  ) x WHERE NOT EXISTS (SELECT 1 FROM @docs d WHERE d.no = x.no);

DECLARE @planCodes TABLE (code nvarchar(120) PRIMARY KEY);
INSERT INTO @planCodes (code)
  SELECT 文档编号 FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs) AND ISNULL(文档编号, N'') <> N'';

SELECT N'[删除前] 命中单据数' AS 项, CAST(COUNT(*) AS nvarchar) AS 值 FROM @docs
UNION ALL SELECT N'[删除前] rd_approval',      CAST(COUNT(*) AS nvarchar) FROM rd_approval      WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] rd_plan',          CAST(COUNT(*) AS nvarchar) FROM rd_plan          WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_doc_status',    CAST(COUNT(*) AS nvarchar) FROM yj_doc_status    WHERE doc_no   IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_form_approval', CAST(COUNT(*) AS nvarchar) FROM yj_form_approval WHERE form_no  IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_message',       CAST(COUNT(*) AS nvarchar) FROM yj_message       WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] rd_progress_detail', CAST(COUNT(*) AS nvarchar) FROM rd_progress_detail
  WHERE ISNULL([说明], N'') LIKE @tagPattern OR ISNULL([项目编号], N'') LIKE @tagPattern;

DELETE FROM yj_message       WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval WHERE form_no  IN (SELECT no FROM @docs);
IF OBJECT_ID('yj_doc_modify_log') IS NOT NULL
  DELETE FROM yj_doc_modify_log WHERE doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status    WHERE doc_no   IN (SELECT no FROM @docs);
IF OBJECT_ID('rd_progress_detail') IS NOT NULL
  DELETE FROM rd_progress_detail
   WHERE ISNULL([项目编号], N'') IN (SELECT code FROM @planCodes)
      OR ISNULL([说明], N'')     IN (SELECT code FROM @planCodes)
      OR ISNULL([项目编号], N'') LIKE @tagPattern
      OR ISNULL([说明], N'')     LIKE @tagPattern;
IF OBJECT_ID('rd_approval_detail') IS NOT NULL
  DELETE FROM rd_approval_detail WHERE 单据编号 IN (SELECT no FROM @docs);
IF OBJECT_ID('rd_plan_detail') IS NOT NULL
  DELETE FROM rd_plan_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_approval WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_plan     WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM s_allno     WHERE 单据编号 IN (SELECT no FROM @docs);

SELECT N'[删除后] 残留单据数' AS 项, CAST(COUNT(*) AS nvarchar) AS 值 FROM (
  SELECT 单据编号 AS no FROM rd_approval WHERE 单据编号 IN (SELECT no FROM @docs)
  UNION ALL SELECT 单据编号 FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs)
) z;
`
  fs.writeFileSync(CLEANUP_SQL, sql, 'utf8')
  console.log(`\n清理脚本已写出: ${CLEANUP_SQL}`)
  console.log(`本次造出单据 ${CREATED.length} 张: ${CREATED.map((c) => `${c.panel}/${c.no}`).join(', ')}`)
  console.log(`合计:格子数=${CELLS.length} PASS=${PASS} FAIL=${FAIL}`)
}

main().catch((e) => { console.error('ERR ' + (e && e.stack || e)); process.exit(1) })
