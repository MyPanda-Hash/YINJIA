/* 研发立项流程「全路径 × 全角色」接口级验证矩阵(2026-10-09)
 *
 * 目的:逐条验证 ButtonService 刚上线的 6 条规则,并找出「某个角色在某条路径上的行为与设计不符」的格子。
 * 做法:全部走真实 HTTP 接口(登录 → /px/callButton → /px/getFormDescriptor / px/rdFlow/state 回读),
 *      造数**只在测试账套 HSDZ_MES_TEST**(脚本开头硬断言 JWT 账套声明,正式库 HSDZ_MES 只读)。
 *
 * ⚠⚠ 账套键是 `YJ_TEST`,不是数据库名 `HSDZ_MES_TEST`(2026-10-09 实发事故):
 *   · DataSourceRouter.java:12-19   PROD="YJ" / TEST="YJ_TEST";用 use(factory) 时
 *     `TEST.equals(factory) ? TEST : PROD` —— **任何不等于 YJ_TEST 的值都静默落正式库**;
 *   · AuthController.java:50-51     登录同样只认 YJ_TEST;
 *   · 账套写在 JWT 声明里,由 JwtAuthFilter.java:36 按请求切库。
 *   ⇒ 传 "HSDZ_MES_TEST" 会**静默写正式库**(本探针第一版就这么干过,10 张单进了 HSDZ_MES)。
 *   故本脚本:① FACTORY 常量写死 YJ_TEST;② 每次登录后断言 data.user.factory==='YJ_TEST',不符即 exit 2。
 *
 * 用法:
 *   node tools/archive/_probe-rd-flow-matrix.cjs      # 全量跑(流程有状态依赖,不做单格过滤)
 *
 * 产物:
 *   · stdout:逐格 PASS/FAIL + 期望/实际(HTTP + 后端 message 原文)
 *   · tools/archive/_probe-rd-flow-matrix-cleanup.sql  ← 本次造出的单据清理脚本(含残留检查)
 *
 * 硬性约束(勿改):
 *   · FACTORY 只能是测试账套;任何非测试账套调用直接 exit 2。
 *   · 不重启服务、不改任何已跟踪源码。
 */
const fs = require('fs')
const path = require('path')

const API = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'                // ← 账套键(DataSourceRouter.TEST);**不是**数据库名 HSDZ_MES_TEST!
const LEDGER_DB = 'HSDZ_MES_TEST'        // ← 该账套对应的库(仅用于文档与清理 SQL 说明)
const CLEANUP_SQL = path.join(__dirname, '_probe-rd-flow-matrix-cleanup.sql')
const LOG = 'C:\\INCER\\YINJIA-MES\\backend\\target\\run.out.log'

if (FACTORY !== 'YJ_TEST') {
  console.error(`[ABORT] FACTORY=${FACTORY} 不是测试账套键 —— 正式库 HSDZ_MES 只读,拒绝造数`)
  process.exit(2)
}

// ───────────────────────── 采集器 ─────────────────────────
const CELLS = []
const CREATED = []              // {panel, no, role, note}
let PASS = 0, FAIL = 0, SKIP = 0

function check(id, flowPath, role, expect, ok, actual, evidence) {
  const state = ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL'
  if (state === 'PASS') PASS++
  else if (state === 'FAIL') FAIL++
  else SKIP++
  CELLS.push({ id, path: flowPath, role, expect, state, actual, evidence: evidence || '' })
  const tag = state === 'PASS' ? 'PASS' : state === 'FAIL' ? 'FAIL' : 'SKIP'
  console.log(`[${tag}] ${id} | ${flowPath} | 角色=${role}`)
  console.log(`       期望: ${expect}`)
  console.log(`       实际: ${actual}`)
  if (evidence) console.log(`       证据: ${evidence}`)
  return state
}

/** 无权限判据:HTTP 200 + code=403(权限类统一走 body-code,见 GlobalExceptionHandler.java:23-26)。
 *  两种文案都属于「被拒」:① 编排层动作权限「当前角色无该面板「X」权限，无法执行「Y」」;
 *  ② ButtonService.requireApprover「当前用户无审批权限」。 */
function isDenied403(r) { return r.code === 403 && /无审批权限|无该面板/.test(String(r.msg)) }

// ───────────────────────── HTTP ─────────────────────────
const TOKENS = {}

async function login(userName) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password: '123456', factory: FACTORY }),
  })
  const j = await r.json()
  if (j?.code !== 200) throw new Error(`登录失败 ${userName}: ${JSON.stringify(j)}`)
  // 硬护栏:JWT 里的账套声明必须是 YJ_TEST,否则说明路由落到了正式库 → 立即中止,绝不继续写
  const got = j.data?.user?.factory
  if (got !== FACTORY) {
    console.error(`[ABORT] 登录 ${userName} 返回账套 factory=${JSON.stringify(got)}(期望 ${FACTORY})`)
    console.error('        路由会落到正式库 HSDZ_MES —— 已中止,未做任何写操作后续。')
    process.exit(2)
  }
  TOKENS[userName] = { token: j.data.token, realName: j.data.user.realName, isAdmin: j.data.user.isAdmin, factory: got }
  return TOKENS[userName]
}

function T(user) {
  const t = TOKENS[user]
  if (!t) throw new Error(`未登录: ${user}`)
  return t.token
}

function nameOf(user) { return TOKENS[user].realName }

/** 原始 callButton:返回 {http, code, msg, data} */
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

/** 展示用的「实际」串:HTTP + code + message 原文 */
function show(r) { return `HTTP=${r.http} code=${r.code} message=「${r.msg}」` }

/** 回读单据字段(getFormDescriptor;缺失键视为空串) */
async function fieldOf(user, panelCode, no, key) {
  const r = await fetch(`${API}/px/getFormDescriptor?panelCode=${encodeURIComponent(panelCode)}&code=${encodeURIComponent(no)}`, {
    headers: { Authorization: `Bearer ${T(user)}` },
  })
  const j = await r.json()
  const v = j?.data?.data?.[key]
  return v == null ? '' : String(v)
}

/** 立项流程状态(门禁预判,前端按钮显隐的唯一真源) */
async function flowState(user, no) {
  const r = await fetch(`${API}/px/rdFlow/state?docNo=${encodeURIComponent(no)}`, { headers: { Authorization: `Bearer ${T(user)}` } })
  const j = await r.json()
  return j?.data || {}
}

// ───────────────────────── 造数小工具 ─────────────────────────
let seq = 0
const TAG = 'MTX' + Date.now().toString(36).toUpperCase()
function docCode(kind) { seq++; return `${TAG}-${kind}${seq}` }

function track(panel, no, role, note) { CREATED.push({ panel, no, role, note }); return no }

/** 建空白草稿(保存为草稿 = markSaved=false:不发号之外的副作用,不送审不归档) */
async function newDraft(user, panel) {
  const r = await call(user, panel, '保存为草稿', {})
  if (r.code !== 200) throw new Error(`建草稿失败 ${user}/${panel}: ${show(r)}`)
  const no = r.data?.['编号']
  track(panel, no, user, 'directAdd 空白草稿')
  return no
}

function logMarkerCount() {
  try {
    const t = fs.readFileSync(LOG, 'utf8')
    return (t.match(/\[RD_PLAN→RD_PROGRESS\]/g) || []).length
  } catch (e) { return -1 }
}

/** 版本戳:把「这份矩阵结果到底验的是哪一版代码」钉死(源码是活文件,并发改动会让结论失真) */
function revisionStamp() {
  const crypto = require('crypto')
  const SRC = 'C:\\INCER\\YINJIA-MES\\backend\\src\\main\\java\\com\\yinjia\\mes\\service\\ButtonService.java'
  const JAR = 'C:\\INCER\\YINJIA-MES\\backend\\target\\yinjia-mes-backend-0.1.0.jar'
  const out = {}
  try { out.srcSha256 = crypto.createHash('sha256').update(fs.readFileSync(SRC)).digest('hex').slice(0, 16) } catch { out.srcSha256 = '(读不到)' }
  try { out.srcMtime = fs.statSync(SRC).mtime.toISOString() } catch { out.srcMtime = '?' }
  try { out.jarMtime = fs.statSync(JAR).mtime.toISOString() } catch { out.jarMtime = '?' }
  try {
    const t = fs.readFileSync(LOG, 'utf8')
    const m = t.match(/^(\S+).*Started MesApplication/m)
    out.appStartedAt = m ? m[1] : '(日志无启动行)'
    const lines = t.match(/Started MesApplication/g)
    out.appStartCount = lines ? lines.length : 0
  } catch { out.appStartedAt = '?' }
  return out
}

// ───────────────────────── 主流程 ─────────────────────────
const D = {}          // 文档登记表:文档编号 + 创建者
const today = new Date().toISOString().slice(0, 10)

async function main() {
  console.log(`=== 研发立项流程矩阵探针 ===`)
  console.log(`TAG=${TAG}  账套键 factory=${FACTORY}(→ 库 ${LEDGER_DB})  API=${API}`)
  const RS = revisionStamp()
  console.log(`版本戳: ButtonService.java sha256=${RS.srcSha256} mtime=${RS.srcMtime}`)
  console.log(`        jar mtime=${RS.jarMtime}  应用启动=${RS.appStartedAt}(启动行数=${RS.appStartCount})`)
  console.log(`LOG=${LOG}  前置 [RD_PLAN→RD_PROGRESS] 行数=${logMarkerCount()}`)
  for (const u of ['admin', 'cp', 'glm53', 'liulei']) { const d = await login(u); console.log(`  登录 ${u} → ${d.realName} isAdmin=${d.isAdmin} factory=${d.factory}(已断言)`) }
  console.log('')

  // ═══ A 组:建单角色(admin / cp / glm53 / liulei)═══
  console.log('──────── A 组:建单(保存为草稿)────────')
  for (const u of ['admin', 'cp', 'glm53', 'liulei']) {
    const r = await call(u, 'RD_APPROVAL', '保存为草稿', {})
    const ok = r.code === 200 && !!r.data?.['编号']
    check(`A-${u}`, '新增/保存为草稿(空白草稿)', u,
      '任何角色都能建草稿 → code=200 且返回编号',
      ok, `${show(r)} 编号=${r.data?.['编号'] || '(无)'}`,
      'ButtonService.java:113 case 新增/保存为草稿 → save(markSaved=false)')
    if (ok) track('RD_APPROVAL', r.data['编号'], u, 'A 组建草稿')
    D['A_' + u] = r.data?.['编号']
  }
  // 建草稿是否真的没送审
  const stA = await flowState('admin', D['A_admin'])
  check('A-draft-state', '建草稿后状态', 'admin', '状态=草稿 / level 空 / 无对接人',
    stA.status === '草稿', `status=${stA.status} level=「${stA.level}」liaison=「${stA.liaison}」`, 'rdFlow/state 回读')

  // ═══ B 组:三条推进路径(送审 / 归档 / 提交审批)═══
  console.log('\n──────── B 组:三条推进路径 ────────')

  // B1 glm53(普通用户)「保存」= 自动送审;同时塞入只读格做防绕过测试
  const d1 = await newDraft('glm53', 'RD_APPROVAL')
  D.D1 = d1
  const c1 = docCode('S2GLM')
  const rB1 = await call('glm53', 'RD_APPROVAL', '保存', {
    编号: d1, 单据日期: today, 文档编号: c1, 客户名: TAG,
    申请立项人: '张三(伪造)', 对接人: 'admin', 项目责任人: 'admin',
  })
  check('B1-glm53-save', '普通用户「保存」= 自动送审', 'glm53',
    'code=200 且单据状态=审批中(pending=Y)',
    rB1.code === 200 && rB1.data?.['单据状态'] === '审批中',
    `${show(rB1)} 返回状态=${rB1.data?.['单据状态']}`,
    'ButtonService.java:482-496 普通用户分支 MERGE pending=Y')
  const stB1 = await flowState('admin', d1)
  check('B1-pending', '普通用户「保存」后落库状态', 'glm53', '审批中', stB1.status === '审批中', `status=${stB1.status}`, 'rdFlow/state 回读')

  // B2 admin「保存」= 保存即归档
  const d2 = await newDraft('admin', 'RD_APPROVAL')
  D.D2 = d2
  const c2 = docCode('S2ADM')
  const rB2 = await call('admin', 'RD_APPROVAL', '保存', { 编号: d2, 单据日期: today, 文档编号: c2, 客户名: TAG })
  check('B2-admin-save', '管理员「保存」= 保存即归档', 'admin',
    'code=200 且状态=已归档(不送审)',
    rB2.code === 200 && rB2.data?.['单据状态'] === '已归档',
    `${show(rB2)} 返回状态=${rB2.data?.['单据状态']}`,
    'ButtonService.java:467-479 isAdminUser → markArchived')

  // B3 cp「保存」(有审批权但是普通用户)= 送审(不是归档)
  const d3 = await newDraft('cp', 'RD_APPROVAL')
  D.D3 = d3
  const c3 = docCode('S2CP')
  const rB3 = await call('cp', 'RD_APPROVAL', '保存', { 编号: d3, 单据日期: today, 文档编号: c3, 客户名: TAG })
  check('B3-cp-save', '有审批权的非管理员「保存」', 'cp',
    '按普通用户口径=送审(审批中),不因有审批权而直接归档',
    rB3.code === 200 && rB3.data?.['单据状态'] === '审批中',
    `${show(rB3)} 返回状态=${rB3.data?.['单据状态']}`,
    'ButtonService.java:468 isAdminUser(user) 只看 is_admin,不看审批权')

  // B4 「提交审批」按钮路径(草稿 → 审批中),操作人 = 申请立项人
  const d4 = await newDraft('cp', 'RD_APPROVAL')
  D.D4 = d4
  const c4 = docCode('S4CP')
  await call('cp', 'RD_APPROVAL', '保存为草稿', { 编号: d4, 单据日期: today, 文档编号: c4, 客户名: TAG })
  const rB4 = await call('cp', 'RD_APPROVAL', '提交审批', { 编号: d4 })
  check('B4-submit-btn', '「提交审批」按钮(草稿→审批中)', 'cp',
    'code=200 且状态=审批中', rB4.code === 200 && rB4.data?.['单据状态'] === '审批中',
    `${show(rB4)} 返回状态=${rB4.data?.['单据状态']}`, 'ButtonService.java:1486 submitApproval → doSubmitApproval')

  // B4b 重复提交:已审批中还点提交审批 → 应拒
  const rB4b = await call('cp', 'RD_APPROVAL', '提交审批', { 编号: d4 })
  check('B4b-submit-twice', '重复「提交审批」', 'cp',
    '拒绝(仅草稿或修改中可提交审批)', rB4b.code !== 200 && String(rB4b.msg).includes('仅草稿或修改中状态可提交审批'),
    show(rB4b), 'ButtonService.java:1507-1508')

  // B4c 已审批中再「保存」→ 应拒
  const rB4c = await call('cp', 'RD_APPROVAL', '保存', { 编号: d4, 单据日期: today, 文档编号: c4 })
  check('B4c-save-while-pending', '审批中单据再保存', 'cp',
    '拒绝(审批中单据不可保存)', rB4c.code !== 200 && String(rB4c.msg).includes('审批中单据不可保存'),
    show(rB4c), 'ButtonService.java:396')

  // ═══ C 组:申请立项人(三条写入点)═══
  console.log('\n──────── C 组:申请立项人 = 把单推进流程的人 ────────')
  const initB1 = await fieldOf('admin', 'RD_APPROVAL', d1, '申请立项人')
  check('C1-initiator-save', '申请立项人(普通用户保存送审)', 'glm53',
    `= 操作人姓名「${nameOf('glm53')}」`, initB1 === nameOf('glm53'),
    `落库 申请立项人=「${initB1}」`, 'ButtonService.java:492-495')
  const initB2 = await fieldOf('admin', 'RD_APPROVAL', d2, '申请立项人')
  check('C2-initiator-admin', '申请立项人(管理员保存即归档)', 'admin',
    `= 操作人姓名「${nameOf('admin')}」`, initB2 === nameOf('admin'),
    `落库 申请立项人=「${initB2}」`, 'ButtonService.java:476-479')
  const initB4 = await fieldOf('admin', 'RD_APPROVAL', d4, '申请立项人')
  check('C3-initiator-submit', '申请立项人(提交审批按钮)', 'cp',
    `= 操作人姓名「${nameOf('cp')}」`, initB4 === nameOf('cp'),
    `落库 申请立项人=「${initB4}」`, 'ButtonService.java:1521-1524')
  // 防绕过:保存时塞的伪造值必须被覆盖;只读格必须被剥离
  check('C4-forge-initiator', '防绕过:保存时伪造「申请立项人」', 'glm53',
    `落库仍 = 操作人「${nameOf('glm53')}」,不带「张三(伪造)」`,
    initB1 === nameOf('glm53') && !initB1.includes('张三'), `落库 申请立项人=「${initB1}」`, '同上(UPDATE 覆盖)')
  const liaB1 = await fieldOf('admin', 'RD_APPROVAL', d1, '对接人')
  const ownB1 = await fieldOf('admin', 'RD_APPROVAL', d1, '项目责任人')
  check('C5-forge-liaison', '防绕过:保存时塞「对接人/项目责任人」', 'glm53',
    '两格都为空白(editable=0 + save() 显式剥离)',
    !liaB1 && !ownB1, `落库 对接人=「${liaB1}」 项目责任人=「${ownB1}」`, 'ButtonService.java:263-266 body.remove')

  // ═══ D 组:审批通过(角色 × 路径)═══
  console.log('\n──────── D 组:审批通过 ────────')
  // D1(glm53 送审)上:无审批权角色尝试
  const rD1 = await call('glm53', 'RD_APPROVAL', '审批通过', { 编号: d1, 项目等级: '二级' })
  check('D1-approve-noperm', '审批通过(无审批权角色)', 'glm53',
    '拒绝:code=403(无该面板「审批」权限)',
    isDenied403(rD1), show(rD1), 'ButtonService.java:1565 requireApprover → :1810(门前另有编排层动作权限)')
  const rD2 = await call('liulei', 'RD_APPROVAL', '审批通过', { 编号: d1, 项目等级: '二级' })
  check('D2-approve-noperm', '审批通过(无审批权角色)', 'liulei',
    '拒绝:code=403(无该面板「审批」权限)',
    isDenied403(rD2), show(rD2), '同一门禁')
  // 提交人自己审批(编制审批分离)
  const rD3 = await call('cp', 'RD_APPROVAL', '审批通过', { 编号: d4, 项目等级: '二级' })
  check('D3-approve-self', '审批通过(提交人本人,有审批权)', 'cp',
    '拒绝:403 审批人不能与提交人相同(编制审批分离)',
    rD3.code === 403 && String(rD3.msg).includes('审批人不能与提交人相同'), show(rD3), 'ButtonService.java:1571-1572')
  // 有审批权且非提交人 → 通过并就地定级
  const rD4 = await call('cp', 'RD_APPROVAL', '审批通过', { 编号: d1, 项目等级: '二级' })
  check('D4-approve-ok', '审批通过(有审批权,非提交人)+ 带等级=二级', 'cp',
    'code=200 且状态=已归档、项目等级=二级',
    rD4.code === 200 && rD4.data?.['单据状态'] === '已归档', `${show(rD4)} 返回状态=${rD4.data?.['单据状态']}`,
    'ButtonService.java:1612-1622 单节点通过 + applyGrade')
  const lvlD1 = await fieldOf('admin', 'RD_APPROVAL', d1, '项目等级')
  check('D5-approve-grade', '审批通过即定级(载荷带项目等级)', 'cp',
    '落库 项目等级=二级', lvlD1 === '二级', `落库 项目等级=「${lvlD1}」`, 'ButtonService.java:1619-1622')
  // admin 审批 cp 提交的单(管理员豁免编制审批分离)
  const rD6 = await call('admin', 'RD_APPROVAL', '审批通过', { 编号: d4 })
  check('D6-approve-admin', '审批通过(管理员,提交人是别人)', 'admin',
    'code=200 且状态=已归档(载荷不带等级 → 事后定级)',
    rD6.code === 200 && rD6.data?.['单据状态'] === '已归档', `${show(rD6)} 返回状态=${rD6.data?.['单据状态']}`,
    'ButtonService.java:1612-1618 level 为空则跳过定级')

  // ═══ E 组:项目定级(规则 1)═══
  console.log('\n──────── E 组:项目定级(只能由本单审批人,且已定级不能改)────────')
  // D1 已归档, 本单审批人=cp, 等级=二级
  const rE1 = await call('admin', 'RD_APPROVAL', '项目定级', { 编号: d1, 项目等级: '一级' })
  check('E1-grade-notapprover', '项目定级(非本单审批人=管理员)', 'admin',
    '拒绝:403 项目定级只能由本单审批人确认(严格,不给管理员兜底)',
    rE1.code === 403 && String(rE1.msg).includes('只能由本单审批人'), show(rE1), 'ButtonService.java:3946-3951')
  const rE2 = await call('glm53', 'RD_APPROVAL', '项目定级', { 编号: d1, 项目等级: '一级' })
  check('E2-grade-noperm', '项目定级(无审批权角色)', 'glm53',
    '拒绝:code=403(无该面板「审批」权限)',
    isDenied403(rE2), show(rE2), 'ButtonService.java:3938 requireApprover 在前')
  const rE3 = await call('cp', 'RD_APPROVAL', '项目定级', { 编号: d1, 项目等级: '三级' })
  check('E3-grade-twice', '项目定级(本单审批人,已定级再定)', 'cp',
    '拒绝:项目等级已确定…不能更改',
    rE3.code !== 200 && String(rE3.msg).includes('不能更改'), show(rE3), 'ButtonService.java:3984-3985 applyGrade 已定级拦截')
  // D4 已归档, 本单审批人=admin, 等级=空 → cp 不是本单审批人
  const rE4 = await call('cp', 'RD_APPROVAL', '项目定级', { 编号: d4, 项目等级: '一级' })
  check('E4-grade-otherapprover', '项目定级(有审批权但非本单审批人)', 'cp',
    '拒绝:403 只能由本单审批人确认',
    rE4.code === 403 && String(rE4.msg).includes('只能由本单审批人'), show(rE4), '同一门禁(反向验证)')
  const rE5 = await call('admin', 'RD_APPROVAL', '项目定级', { 编号: d4, 项目等级: '一级' })
  check('E5-grade-approver-ok', '项目定级(本单审批人=管理员)', 'admin',
    'code=200(本单审批人就算是管理员也放行)',
    rE5.code === 200, show(rE5), 'ButtonService.java:3949 approver.equals(currentUserName())')
  // 未审核的草稿定级
  const dE = D['A_cp']
  const rE6 = await call('cp', 'RD_APPROVAL', '项目定级', { 编号: dE, 项目等级: '一级' })
  check('E6-grade-draft', '项目定级(草稿态)', 'cp',
    '拒绝:仅已审核或已归档的立项申请可项目定级',
    rE6.code !== 200 && String(rE6.msg).includes('仅已审核或已归档'), show(rE6), 'ButtonService.java:3942-3943')

  // ═══ F 组:分发对接人(规则 2)═══
  console.log('\n──────── F 组:分发对接人(只能一次)────────')
  // D1:已归档 + 等级=二级 + 无对接人
  const rF1 = await call('cp', 'RD_APPROVAL', '分发对接人', { 编号: d1, 对接人: 'cp' })
  check('F1-dispatch-first', '分发对接人(首次,有审批权)', 'cp',
    'code=200,落库 备用1=cp',
    rF1.code === 200, `${show(rF1)} 返回=${JSON.stringify(rF1.data)}`, 'ButtonService.java:4024-4055')
  const liaD1 = await fieldOf('admin', 'RD_APPROVAL', d1, '对接人')
  check('F2-dispatch-persist', '分发对接人落库', 'cp', '落库 对接人=cp', liaD1 === 'cp', `落库 对接人=「${liaD1}」`, '同上报数')
  const rF3 = await call('cp', 'RD_APPROVAL', '分发对接人', { 编号: d1, 对接人: 'glm53' })
  check('F3-dispatch-twice', '分发对接人(第二次/改人)', 'cp',
    '拒绝:对接人已分发给…不能更改',
    rF3.code !== 200 && String(rF3.msg).includes('不能更改'), show(rF3), 'ButtonService.java:4037-4040')
  const rF4 = await call('admin', 'RD_APPROVAL', '分发对接人', { 编号: d1, 对接人: 'glm53' })
  check('F4-dispatch-twice-admin', '分发对接人(第二次,管理员)', 'admin',
    '拒绝:不能更改(管理员也不越过"只能一次")',
    rF4.code !== 200 && String(rF4.msg).includes('不能更改'), show(rF4), '同一门禁')
  // 未定级就分发(D4 已定级=一级 → 换一张未定级的)
  const dF = await newDraft('glm53', 'RD_APPROVAL')
  D.D5 = dF
  const cF = docCode('NOLVL')
  await call('glm53', 'RD_APPROVAL', '保存', { 编号: dF, 单据日期: today, 文档编号: cF, 客户名: TAG })
  await call('admin', 'RD_APPROVAL', '审批通过', { 编号: dF })     // 不带等级 → 已归档、level 空
  const rF5 = await call('admin', 'RD_APPROVAL', '分发对接人', { 编号: dF, 对接人: 'glm53' })
  check('F5-dispatch-nolevel', '分发对接人(未定级)', 'admin',
    '拒绝:请先完成项目定级,再分发对接人',
    rF5.code !== 200 && String(rF5.msg).includes('请先完成项目定级'), show(rF5), 'ButtonService.java:4034-4035')
  const rF6 = await call('glm53', 'RD_APPROVAL', '分发对接人', { 编号: dF, 对接人: 'glm53' })
  check('F6-dispatch-noperm', '分发对接人(无审批权角色)', 'glm53',
    '拒绝:code=403',
    isDenied403(rF6), show(rF6), 'ButtonService.java:4026 requireApprover')
  const rF7 = await call('admin', 'RD_APPROVAL', '分发对接人', { 编号: D['A_admin'], 对接人: 'glm53' })
  check('F7-dispatch-draft', '分发对接人(草稿态)', 'admin',
    '拒绝:仅已审核或已归档…(当前:草稿)',
    rF7.code !== 200 && String(rF7.msg).includes('仅已审核或已归档'), show(rF7), 'ButtonService.java:4031-4032')

  // ═══ G 组:确认责任人(规则 3)═══
  console.log('\n──────── G 组:确认项目责任人(对接人本人签核,只能一次)────────')
  // D1:对接人=cp。先造一张 对接人=glm53 的单用于"非对接人"测试
  // D5(D5=dF)未定级 → 先定级再分发对接人=glm53, 用 admin
  await call('admin', 'RD_APPROVAL', '项目定级', { 编号: dF, 项目等级: '四级' })
  const rG0 = await call('admin', 'RD_APPROVAL', '分发对接人', { 编号: dF, 对接人: 'glm53' })
  check('G0-setup-dispatch', '前置:分发对接人=glm53(定级后)', 'admin', 'code=200', rG0.code === 200, show(rG0), '前置步骤')
  const rG1 = await call('liulei', 'RD_APPROVAL', '确认责任人', { 编号: dF, 项目责任人: 'liulei' })
  check('G1-owner-nonliaison', '确认责任人(非对接人、非管理员)', 'liulei',
    '拒绝:403 仅本单对接人或管理员可确认项目责任人',
    rG1.code === 403 && String(rG1.msg).includes('仅本单对接人或管理员'), show(rG1), 'ButtonService.java:4075-4076')
  const rG2 = await call('admin', 'RD_APPROVAL', '确认责任人', { 编号: dF, 项目责任人: 'liulei' })
  console.log(`[观察] 管理员(非对接人)确认责任人 → ${show(rG2)}`)
  const g2DidWrite = rG2.code === 200
  check('G2-owner-admin', '确认责任人(管理员代确认)', 'admin',
    '【设计未明说】代码允许管理员兜底 → 本格只记录实际行为不改写设计',
    null, `${show(rG2)};落库 项目责任人=「${await fieldOf('admin', 'RD_APPROVAL', dF, '项目责任人')}」`,
    'ButtonService.java:4075 管理员兜底分支(与「分发责任人」同款)')
  if (g2DidWrite) {
    const rG2b = await call('glm53', 'RD_APPROVAL', '确认责任人', { 编号: dF, 项目责任人: 'cp' })
    check('G3-owner-twice', '确认责任人(已确认再确认)', 'glm53',
      '拒绝:项目责任人已确认为…不能更改',
      rG2b.code !== 200 && String(rG2b.msg).includes('不能更改'), show(rG2b), 'ButtonService.java:4078-4081')
  } else {
    const rG3 = await call('glm53', 'RD_APPROVAL', '确认责任人', { 编号: dF, 项目责任人: 'liulei' })
    check('G3-owner-liaison-ok', '确认责任人(对接人本人=glm53)', 'glm53',
      'code=200,落库 备用2=liulei', rG3.code === 200, show(rG3), 'ButtonService.java:4082-4088')
    const own = await fieldOf('admin', 'RD_APPROVAL', dF, '项目责任人')
    check('G3b-owner-persist', '确认责任人落库', 'glm53', '落库 项目责任人=liulei', own === 'liulei', `落库 项目责任人=「${own}」`, '同上报数')
    const rG4 = await call('glm53', 'RD_APPROVAL', '确认责任人', { 编号: dF, 项目责任人: 'cp' })
    check('G4-owner-twice', '确认责任人(已确认再确认)', 'glm53',
      '拒绝:项目责任人已确认为…不能更改',
      rG4.code !== 200 && String(rG4.msg).includes('不能更改'), show(rG4), 'ButtonService.java:4078-4081')
  }
  // 未分发对接人就确认责任人(D4 有对接人? 没有 → 用 D3 建的草稿单? 用未分发的已归档单)
  const dG = await newDraft('glm53', 'RD_APPROVAL')
  D.D6 = dG
  const cG = docCode('NOOWNER')
  await call('glm53', 'RD_APPROVAL', '保存', { 编号: dG, 单据日期: today, 文档编号: cG, 客户名: TAG })
  await call('admin', 'RD_APPROVAL', '审批通过', { 编号: dG, 项目等级: '一级' })
  const rG5 = await call('admin', 'RD_APPROVAL', '确认责任人', { 编号: dG, 项目责任人: 'cp' })
  check('G5-owner-noliaison', '确认责任人(未分发对接人)', 'admin',
    '拒绝:请先分发对接人,再由对接人确认项目责任人',
    rG5.code !== 200 && String(rG5.msg).includes('请先分发对接人'), show(rG5), 'ButtonService.java:4073-4074')
  // 分发到不存在的账号(dG 已定级且无对接人 → 才能走到"账号校验"这一层)
  const rF8 = await call('admin', 'RD_APPROVAL', '分发对接人', { 编号: dG, 对接人: '__no_such_user__' })
  check('F8-dispatch-baduser', '分发对接人(账号不存在)', 'admin',
    '拒绝:对接人账号不存在或已停用',
    rF8.code !== 200 && String(rF8.msg).includes('不存在或已停用'), show(rF8), 'ButtonService.java:4043')
  // 分发对接人的权限口径**不限定本单审批人**(只要求"该面板审批权"),与「项目定级」的严格口径不对称
  const rF9 = await call('cp', 'RD_APPROVAL', '分发对接人', { 编号: dG, 对接人: 'liulei' })
  check('F9-dispatch-otherapprover', '分发对接人(有审批权但非本单审批人)', 'cp',
    'code=200(设计:该面板审批人 ∪ 管理员,不限本单审批人)',
    rF9.code === 200, show(rF9), 'ButtonService.java:4026 requireApprover 只查面板审批权')
  // 对接人本人 = 执行人(对接人自己确认,D1 的对接人=cp)
  const rG6 = await call('cp', 'RD_APPROVAL', '确认责任人', { 编号: d1, 项目责任人: 'glm53' })
  check('G6-owner-self', '确认责任人(执行人=对接人本人=cp)', 'cp',
    'code=200,落库 备用2=glm53', rG6.code === 200, show(rG6), 'ButtonService.java:4075 user.equals(liaison)')
  const rG7 = await call('cp', 'RD_APPROVAL', '确认责任人', { 编号: d1, 项目责任人: 'liulei' })
  check('G7-owner-twice-2', '确认责任人(再确认一次)', 'cp',
    '拒绝:不能更改', rG7.code !== 200 && String(rG7.msg).includes('不能更改'), show(rG7), '同一门禁')

  // ═══ H 组:弃审后重走(规则 6)═══
  console.log('\n──────── H 组:弃审(unaudit)后清除与重走 ────────')
  const beforeH = await flowState('admin', d1)
  const rH1 = await call('cp', 'RD_APPROVAL', '弃审', { 编号: d1 })
  check('H1-unaudit', '弃审(已归档 → 草稿)', 'cp',
    'code=200 且状态=草稿',
    rH1.code === 200 && rH1.data?.['单据状态'] === '草稿', `${show(rH1)} 返回状态=${rH1.data?.['单据状态']}`,
    'ButtonService.java:1357-1448')
  const afterH = await flowState('admin', d1)
  check('H2-unaudit-level', '弃审后清空「项目等级」', 'cp',
    `清空(弃审前=「${beforeH.level}」)→ 空`,
    afterH.level === '', `弃审后 level=「${afterH.level}」`,
    'ButtonService.java:1421-1431 弃审 SET 备用1=NULL, 备用2=NULL, 项目等级=NULL')
  check('H3-unaudit-liaison', '弃审后清空「对接人」', 'cp',
    `清空(弃审前=「${beforeH.liaison}」)→ 空`,
    afterH.liaison === '', `弃审后 liaison=「${afterH.liaison}」`, 'ButtonService.java:1427')
  check('H4-unaudit-owner', '弃审后清空「项目责任人」', 'cp',
    `清空(弃审前=「${beforeH.owner}」)→ 空`,
    afterH.owner === '', `弃审后 owner=「${afterH.owner}」`, 'ButtonService.java:1427')
  // 重走:提交审批 → 审批通过(带等级) —— 弃审若没清「项目等级」,这里就是死锁格
  const rH5 = await call('cp', 'RD_APPROVAL', '提交审批', { 编号: d1 })
  check('H5-resubmit', '弃审后重新提交审批', 'cp', 'code=200 且状态=审批中',
    rH5.code === 200 && rH5.data?.['单据状态'] === '审批中', `${show(rH5)} 返回状态=${rH5.data?.['单据状态']}`, '重走第 1 步')
  const rH6 = await call('admin', 'RD_APPROVAL', '审批通过', { 编号: d1, 项目等级: '三级' })
  check('H6-reapprove-grade', '弃审后重新审批通过 + 重新定级', 'admin',
    'code=200 且状态=已归档(弃审已清空等级 ⇒ 不触发「已定级不能改」)',
    rH6.code === 200 && rH6.data?.['单据状态'] === '已归档', `${show(rH6)} 返回状态=${rH6.data?.['单据状态']}`,
    '★ 回归点:弃审若不清「项目等级」,applyGrade(:3984-3985) 会拒 ⇒ 本格死锁在审批中')
  const lvlH6 = await fieldOf('admin', 'RD_APPROVAL', d1, '项目等级')
  check('H7-reapprove-level', '重走后项目等级落库值', 'admin', '= 三级', lvlH6 === '三级', `落库 项目等级=「${lvlH6}」`, '同上报数')

  // 再来一轮:走"审批通过不带等级 → 事后单独定级"的路,验「弃审后能重新定级」
  const rH8 = await call('admin', 'RD_APPROVAL', '弃审', { 编号: d1 })
  check('H8-unaudit-again', '第二次弃审(已归档→草稿)', 'admin', 'code=200 且状态=草稿',
    rH8.code === 200 && rH8.data?.['单据状态'] === '草稿', `${show(rH8)} 返回状态=${rH8.data?.['单据状态']}`, '同一门禁')
  const stH8 = await flowState('admin', d1)
  check('H9-level-cleared-again', '第二次弃审后「项目等级」再次清空', 'admin', '空',
    stH8.level === '', `弃审后 level=「${stH8.level}」`, 'ButtonService.java:1421-1431')
  const rH10 = await call('cp', 'RD_APPROVAL', '提交审批', { 编号: d1 })
  const rH11 = await call('admin', 'RD_APPROVAL', '审批通过', { 编号: d1 })
  check('H11-approve-nolevel', '重走后审批通过(不带等级)', 'admin', 'code=200 且状态=已归档(等级留空)',
    rH11.code === 200 && rH10.code === 200, `${show(rH10)} → ${show(rH11)} 返回状态=${rH11.data?.['单据状态']}`, 'ButtonService.java:1618 空等级跳过定级')
  const rH12 = await call('admin', 'RD_APPROVAL', '项目定级', { 编号: d1, 项目等级: '四级' })
  check('H12-regrade-alone', '弃审重走后单独点「项目定级」', 'admin',
    'code=200(等级已清空 ⇒ 可重新定级)',
    rH12.code === 200, show(rH12), '★ applyGrade 已定级拦截(本格验证"清干净了")')
  const lvlH12 = await fieldOf('admin', 'RD_APPROVAL', d1, '项目等级')
  check('H13-regrade-persist', '重新定级落库值', 'admin', '= 四级', lvlH12 === '四级', `落库 项目等级=「${lvlH12}」`, '同上报数')
  const rH14 = await call('admin', 'RD_APPROVAL', '项目定级', { 编号: d1, 项目等级: '一级' })
  check('H14-regrade-again', '重新定级后再定一次', 'admin', '拒绝:不能更改(确定后不可变)',
    rH14.code !== 200 && String(rH14.msg).includes('不能更改'), show(rH14), 'ButtonService.java:3984-3985')

  // ═══ I 组:门禁一致性(界面让点 / 后端拒绝 的错配)═══
  console.log('\n──────── I 组:rdFlow/state 门禁与实际按钮结果一致性 ────────')
  for (const [key, role] of [['E1-grade-notapprover', 'admin'], ['F3-dispatch-twice', 'cp'], ['G7-owner-twice-2', 'cp']]) {
    const c = CELLS.find((x) => x.id === key)
    if (c) console.log(`  参考格 ${key}: ${c.state}`)
  }
  const stD4 = await flowState('cp', d4)     // D4 已归档、已定级一级、无对接人、本单审批人=admin
  check('I1-flowstate-grade', 'rdFlow/state.canGradeProject(非本单审批人=cp)', 'cp',
    'false(与 E4 后端拒绝一致)', stD4.canGradeProject === false,
    `status=${stD4.status} level=「${stD4.level}」canGradeProject=${stD4.canGradeProject}`, 'ButtonService.java:4134')
  const stD1b = await flowState('admin', d1)
  check('I2-flowstate-dispatch', 'rdFlow/state.canDispatchLiaison(已定级+有审批权)', 'admin',
    'true(等级存在、无对接人、管理员可批)',
    stD1b.level !== '' && stD1b.liaison === '' ? stD1b.canDispatchLiaison === true : null,
    `level=「${stD1b.level}」liaison=「${stD1b.liaison}」owner=「${stD1b.owner}」canDispatchLiaison=${stD1b.canDispatchLiaison}`,
    'ButtonService.java:4135')

  // ═══ J 组:RD_PLAN 保存→送审→审批通过→归档 → 自动进 RD_PROGRESS(规则 5)═══
  console.log('\n──────── J 组:项目实施计划 → 项目进度查询 自动同步 ────────')
  const planNo = await newDraft('glm53', 'RD_PLAN')
  D.PLAN1 = planNo
  const planDocCode = docCode('PLAN')
  const planName = `${TAG}-项目A`
  const planFields = {
    编号: planNo, 单据日期: today, 项目名称: planName, 项目定级: '二级',
    文档编号: planDocCode, 阶段1_计划内容: '阶段一:方案确认', 阶段1_计划完成: today, 负责人: nameOf('glm53'),
  }
  const rJ1 = await call('glm53', 'RD_PLAN', '保存', planFields)
  check('J1-plan-save', 'RD_PLAN 普通用户保存=送审', 'glm53',
    'code=200 且状态=审批中', rJ1.code === 200 && rJ1.data?.['单据状态'] === '审批中',
    `${show(rJ1)} 返回状态=${rJ1.data?.['单据状态']}`, 'ButtonService.java:482-496')
  const rJ2 = await call('glm53', 'RD_PLAN', '审批通过', { 编号: planNo })
  check('J2-plan-approve-noperm', 'RD_PLAN 审批通过(无审批权)', 'glm53',
    '拒绝:code=403', isDenied403(rJ2), show(rJ2), 'requireApprover')
  const markersBefore = logMarkerCount()
  const rJ3 = await call('admin', 'RD_PLAN', '审批通过', { 编号: planNo })
  check('J3-plan-approve', 'RD_PLAN 管理员审批通过 → 归档', 'admin',
    'code=200 且状态=已归档', rJ3.code === 200 && rJ3.data?.['单据状态'] === '已归档',
    `${show(rJ3)} 返回状态=${rJ3.data?.['单据状态']}`, 'ButtonService.java:1656-1664 归档')
  const markersAfter = logMarkerCount()
  check('J4-plan-log', '归档触发自动同步(后端日志)', 'admin',
    `日志出现新的「[RD_PLAN→RD_PROGRESS]」行(前=${markersBefore} 后=${markersAfter})`,
    markersAfter > markersBefore, `markers ${markersBefore} → ${markersAfter}`, `${LOG}`)
  const pr = await fetch(`${API}/px/queryFormDataList`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T('admin')}` },
    body: JSON.stringify({ panelCode: 'RD_PROGRESS', condition: {}, pageNo: 1, pageSize: 20 }),
  })
  const pj = await pr.json()
  const progDocs = pj?.data?.list || []
  const allItems = progDocs.flatMap((d) => (d.detail?.items || []).map((it) => ({ doc: d['单据编号'], it })))
  const mine = allItems.find((x) => String(x.it['项目编号'] || '') === planDocCode)
  check('J5-plan-progress', 'RD_PLAN 归档后自动出现在 RD_PROGRESS', 'admin',
    `进度查询任一单据的明细出现 项目编号=${planDocCode}`,
    !!mine,
    mine ? `命中 ${mine.doc}: ${JSON.stringify(mine.it)}`
      : `未命中;进度查询共 ${progDocs.length} 张单(${progDocs.map((d) => d['单据编号']).join(',')}),现有项目编号=${JSON.stringify(allItems.map((x) => x.it['项目编号']))}`,
    'syncAllPlansToProgress → syncPlanToProgress(项目编号=RD_PLAN.文档编号)')

  // ═══ K 组:归档后再保存(是否绕开申请修改)═══
  console.log('\n──────── K 组:已归档单据再保存 ────────')
  const dK = await newDraft('glm53', 'RD_APPROVAL')
  D.D7 = dK
  const cK = docCode('ARCH')
  await call('glm53', 'RD_APPROVAL', '保存', { 编号: dK, 单据日期: today, 文档编号: cK, 客户名: TAG })
  await call('admin', 'RD_APPROVAL', '审批通过', { 编号: dK, 项目等级: '一级' })
  const stK = await flowState('admin', dK)
  const rK = await call('glm53', 'RD_APPROVAL', '保存', { 编号: dK, 单据日期: today, 文档编号: cK, 客户名: TAG })
  const stK2 = await flowState('admin', dK)
  check('K1-archived-save', '已归档单据普通用户再「保存」', 'glm53',
    '【期望待确认】文书面板归档后应走「申请修改」→ 期望拒绝;实际观察',
    null, `归档态=${stK.status} → 保存后 ${show(rK)} → 新状态=${stK2.status}`,
    'ButtonService.java:395-409 状态锁清单**不含「已归档」**')

  // ═══ 汇总 ═══
  console.log('\n════════════════ 汇总 ════════════════')
  console.log(`格子数=${CELLS.length}  PASS=${PASS}  FAIL=${FAIL}  SKIP(待确认)=${SKIP}`)
  console.log('\nFAIL 明细:')
  for (const c of CELLS.filter((x) => x.state === 'FAIL')) {
    console.log(`  ✗ ${c.id} [${c.role}] ${c.path}`)
    console.log(`      期望: ${c.expect}`)
    console.log(`      实际: ${c.actual}`)
  }
  console.log('\nSKIP / 待用户确认:')
  for (const c of CELLS.filter((x) => x.state === 'SKIP')) {
    console.log(`  ? ${c.id} [${c.role}] ${c.path}`)
    console.log(`      实际: ${c.actual}`)
  }

  // ── markdown 矩阵表(行=路径,列=角色)──
  const ROLES = ['admin', 'cp', 'glm53', 'liulei']
  const paths = [...new Set(CELLS.map((c) => c.path))]
  const mark = (c) => (!c ? '—' : c.state === 'PASS' ? `✅ ${c.id}` : c.state === 'FAIL' ? `❌ ${c.id}` : `❔ ${c.id}`)
  console.log('\n════════════════ markdown 矩阵表(直接粘贴)════════════════')
  console.log('| 路径 \\ 角色 | admin（系统管理员,isAdmin） | cp（陈秀丽,rd_review+RD_APPROVAL审批权） | glm53（彭于晏,普通） | liulei（刘磊,普通/文件负责人） |')
  console.log('|---|---|---|---|---|')
  for (const p of paths) {
    const cols = ROLES.map((r) => mark(CELLS.find((c) => c.path === p && c.role === r)))
    console.log(`| ${p} | ${cols.join(' | ')} |`)
  }
  console.log(`\n图例:✅=PASS ❌=FAIL ❔=待用户确认 —=该角色此路径不适用/未测`)
  console.log(`合计:格子数=${CELLS.length} PASS=${PASS} FAIL=${FAIL} SKIP=${SKIP}`)

  // 清理脚本
  const valuesList = CREATED.length ? CREATED.map((c) => `(N'${c.no}')`).join(',') : "(N'__none__')"
  const sql = `/* 清理:研发立项流程矩阵探针(_probe-rd-flow-matrix.cjs)在测试账套造出的单据
   TAG=${TAG}  生成时间=${new Date().toISOString()}
   归属判据(两条同时成立才算本探针造的):
     ① 本次运行的显式单据号清单(= @docs 里的 VALUES 部分);
     ② 标记位:立项单 客户名 = '${TAG}' 或以 MTX 开头、实施计划 项目名称 同理(@tagPattern 扫一遍,
        覆盖本探针的历史运行 —— 该探针每次运行都写自己的 TAG,不会误伤别人)。
   ⚠ 只对测试账套跑!正式库 HSDZ_MES 不受影响(探针硬断言 JWT 账套声明=YJ_TEST 才动手)。
   ⚠ 本脚本刻意不写 USE(DbSync 会拒绝无条件 USE),请显式指定库:
     sqlcmd -S 127.0.0.1,1433 -U yinjia -P '<pass>' -d HSDZ_MES_TEST -i <本文件> -W -s"|"
     (DbSync 不显示 SELECT 结果,残留检查必须用 sqlcmd / SSMS)
   注:此处 HSDZ_MES_TEST 是**数据库名**;接口侧的账套键是 YJ_TEST,两者不同,别混。 */
SET NOCOUNT ON;
DECLARE @tagPattern nvarchar(60) = N'MTX%';
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
-- ① 本次运行的显式清单
INSERT INTO @docs (no)
  SELECT v FROM (VALUES ${valuesList}) AS t(v)
  WHERE v <> N'__none__' AND NOT EXISTS (SELECT 1 FROM @docs d WHERE d.no = t.v);
-- ② 标记位扫描(覆盖历史运行;去重,否则与 ① 撞主键)
INSERT INTO @docs (no)
  SELECT x.no FROM (
    SELECT 单据编号 AS no FROM rd_approval WHERE 客户名 LIKE @tagPattern
    UNION SELECT 单据编号 FROM rd_plan WHERE 项目名称 LIKE @tagPattern
  ) x WHERE NOT EXISTS (SELECT 1 FROM @docs d WHERE d.no = x.no);

-- ③ 项目实施计划的**业务文档编号**(进度查询里的 说明/项目编号 存的是它,不是单据编号)
DECLARE @planCodes TABLE (code nvarchar(120) PRIMARY KEY);
INSERT INTO @planCodes (code)
  SELECT 文档编号 FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs) AND ISNULL(文档编号, N'') <> N'';

-- 删除前:先报出"将要动几条"(自证不是空跑)
SELECT N'[删除前] 命中单据数' AS 项, CAST(COUNT(*) AS nvarchar) AS 值 FROM @docs
UNION ALL SELECT N'[删除前] rd_approval', CAST(COUNT(*) AS nvarchar) FROM rd_approval WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] rd_plan', CAST(COUNT(*) AS nvarchar) FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_doc_status', CAST(COUNT(*) AS nvarchar) FROM yj_doc_status WHERE doc_no IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_form_approval', CAST(COUNT(*) AS nvarchar) FROM yj_form_approval WHERE form_no IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] yj_message', CAST(COUNT(*) AS nvarchar) FROM yj_message WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[删除前] rd_progress_detail(计划同步行)', CAST(COUNT(*) AS nvarchar) FROM rd_progress_detail WHERE ISNULL([说明], N'') IN (SELECT no FROM @docs) OR ISNULL([说明], N'') LIKE @tagPattern;

-- 单据级留痕(顺序:消息 → 审批留痕 → 修改日志 → 状态)
DELETE FROM yj_message         WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval   WHERE form_no IN (SELECT no FROM @docs);
IF OBJECT_ID('yj_doc_modify_log') IS NOT NULL
  DELETE FROM yj_doc_modify_log WHERE doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status      WHERE doc_no IN (SELECT no FROM @docs);

-- 项目进度查询里由本次计划同步出来的行(说明/项目编号 = RD_PLAN.文档编号)
IF OBJECT_ID('rd_progress_detail') IS NOT NULL
  DELETE FROM rd_progress_detail WHERE ISNULL([说明], N'') IN (SELECT code FROM @planCodes);
IF OBJECT_ID('rd_progress_detail') IS NOT NULL
  DELETE FROM rd_progress_detail WHERE ISNULL([项目编号], N'') IN (SELECT code FROM @planCodes);
-- 兜底:历史运行的计划单已被删掉、@planCodes 取不到时,用标记位直接扫(说明里存的就是 MTX…-PLANn)
IF OBJECT_ID('rd_progress_detail') IS NOT NULL
  DELETE FROM rd_progress_detail WHERE ISNULL([说明], N'') LIKE @tagPattern OR ISNULL([项目编号], N'') LIKE @tagPattern;

-- 业务表
IF OBJECT_ID('rd_approval_detail') IS NOT NULL
  DELETE FROM rd_approval_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_approval WHERE 单据编号 IN (SELECT no FROM @docs);
IF OBJECT_ID('rd_plan_detail') IS NOT NULL
  DELETE FROM rd_plan_detail WHERE 单据编号 IN (SELECT no FROM @docs);
IF OBJECT_ID('rd_plan') IS NOT NULL
  DELETE FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs);

-- 残留检查(应全为 0);对照组:按同一判据查一个必然不存在的号,必须为 0
SELECT N'[残留] rd_approval' AS 项, CAST(COUNT(*) AS nvarchar) AS 值 FROM rd_approval WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[残留] rd_plan', CAST(COUNT(*) AS nvarchar) FROM rd_plan WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[残留] yj_doc_status', CAST(COUNT(*) AS nvarchar) FROM yj_doc_status WHERE doc_no IN (SELECT no FROM @docs)
UNION ALL SELECT N'[残留] yj_form_approval', CAST(COUNT(*) AS nvarchar) FROM yj_form_approval WHERE form_no IN (SELECT no FROM @docs)
UNION ALL SELECT N'[残留] yj_message', CAST(COUNT(*) AS nvarchar) FROM yj_message WHERE 单据编号 IN (SELECT no FROM @docs)
UNION ALL SELECT N'[残留] rd_progress_detail', CAST(COUNT(*) AS nvarchar) FROM rd_progress_detail WHERE ISNULL([说明], N'') IN (SELECT code FROM @planCodes) OR ISNULL([项目编号], N'') IN (SELECT code FROM @planCodes)
UNION ALL SELECT N'[残留] rd_progress_detail(标记位扫)', CAST(COUNT(*) AS nvarchar) FROM rd_progress_detail WHERE ISNULL([说明], N'') LIKE @tagPattern OR ISNULL([项目编号], N'') LIKE @tagPattern
UNION ALL SELECT N'[残留] 按标记位再扫 rd_approval', CAST(COUNT(*) AS nvarchar) FROM rd_approval WHERE 客户名 LIKE @tagPattern
UNION ALL SELECT N'[残留] 按标记位再扫 rd_plan', CAST(COUNT(*) AS nvarchar) FROM rd_plan WHERE 项目名称 LIKE @tagPattern
UNION ALL SELECT N'[对照组] 必然不存在的号 __NEVER__', CAST(COUNT(*) AS nvarchar) FROM rd_approval WHERE 单据编号 = N'__NEVER__';
`
  fs.writeFileSync(CLEANUP_SQL, sql, 'utf8')
  console.log(`\n清理脚本已写出: ${CLEANUP_SQL}`)
  console.log(`本次造单 ${CREATED.length} 张: ${CREATED.map((c) => `${c.panel}/${c.no}(${c.role})`).join(', ')}`)
  console.log(`重跑: node tools/archive/_probe-rd-flow-matrix.cjs`)
}

main().catch((e) => { console.error('ERR', e.message, e.stack); process.exit(1) })
