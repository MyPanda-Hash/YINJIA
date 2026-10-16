/* 规格书漂移提示 + 四文件弃审放宽 —— 端到端接口验证(2026-10-16 用户口径)
 *
 * 用户原话:「产品信息表分发下去的 4 类单据没有反审核,写错了改不了……有一些单据是引用的规格书的数据,
 *   要是规格书申请修改数据了,但是其他的引用数据的单据是归档状态……应该有一个提示,提示说单据对应的
 *   规格书申请修改了数据,请及时核对,这些单据也可以对应的反审核然后重新引用数据」
 *
 * 本探针造一条**真实链**(全部走 HTTP 接口,只在测试账套):
 *   产品信息表(建单→提交审批→一级(admin、选 cp 为二级)→ cp 二级签核 → 已归档)
 *     → 分发责任人(规格书→cp;成型工艺清单→chaishanyin)
 *     → 规格书(建单→规格书分发盖章→归档)
 *     → 成型工艺清单(建单→归档)
 * 然后逐条验:
 *   ① 规格书归档在前、引用单归档在后 ⇒ 不提示(不误报);
 *   ② 规格书申请修改后 ⇒ 引用单漂移接口 needCheck=true / reason=spec_in_flux;
 *   ③ 引用单**责任人**(chaishanyin,角色「文件负责人」无 audit 词)弃审 ⇒ code=200
 *      (改动前被前门挡下:403「当前角色无该面板「审批」权限,无法执行「弃审」」);
 *   ④ 非责任人非审批人(liulei)弃审 ⇒ 仍被拒(门禁没被放宽成"谁都能弃审")。
 *
 * ⚠ 账套键是 `YJ_TEST`,不是库名 HSDZ_MES_TEST(传库名会静默写正式库 —— 见 _probe-rd-flow-matrix.cjs 头部)。
 * ⚠ 按钮名按 UI 实际发的来:前端把「保存」映射成「提交」(engine.js callButton),所以归档走「提交」。
 * 用法:node tools/archive/_probe-spec-drift/spec-drift.cjs
 *      跑完清场:cd tools; $env:YINJIA_SQL_DB="HSDZ_MES_TEST"; java -cp lib\mssql-jdbc.jar DbSync.java run cleanup-rd-testledger-20261016.sql
 */
const API = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const PRODUCT = 'P-SDRIFT-01'
const PNAME = '漂移验证用产品'
const TOKENS = {}
let PASS = 0, FAIL = 0

function check(id, expect, ok, actual) {
  const tag = ok ? 'PASS' : 'FAIL'
  if (ok) PASS++; else FAIL++
  console.log(`[${tag}] ${id}`)
  console.log(`       期望: ${expect}`)
  console.log(`       实际: ${actual}`)
}

async function login(userName) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password: '123456', factory: FACTORY }),
  })
  const j = await r.json()
  if (j?.code !== 200) throw new Error(`登录失败 ${userName}: ${JSON.stringify(j)}`)
  if (j.data?.user?.factory !== FACTORY) {
    console.error(`[ABORT] 账套声明 ${JSON.stringify(j.data?.user?.factory)} != ${FACTORY} —— 会写正式库,中止`)
    process.exit(2)
  }
  TOKENS[userName] = j.data.token
  return j.data.user
}

const T = (u) => { if (!TOKENS[u]) throw new Error(`未登录:${u}`); return TOKENS[u] }

async function call(user, panelCode, buttonName, formData) {
  const r = await fetch(`${API}/px/callButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T(user)}` },
    body: JSON.stringify({ panelCode, buttonName, formData: formData || {}, buttonParam: {} }),
  })
  const j = await r.json().catch(() => null)
  return { http: r.status, code: j?.code, msg: j?.message ?? j?.msg ?? '', data: j?.data }
}

async function get(user, path) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${T(user)}` } })
  const j = await r.json().catch(() => null)
  return { http: r.status, code: j?.code, data: j?.data, msg: j?.message ?? '', raw: JSON.stringify(j).slice(0, 300) }
}

const driftOf = (user, panel, no) => get(user, `/px/rdDev/specDrift?panelCode=${panel}&docNo=${encodeURIComponent(no)}`)
const fieldOf = async (user, panel, no, key) => {
  const r = await get(user, `/px/getFormDescriptor?panelCode=${panel}&code=${encodeURIComponent(no)}`)
  const v = r.data?.data?.[key]
  return v == null ? '' : String(v)
}
/** 建草稿(带字段)→ 返回编号 */
async function newDraft(user, panel, fields) {
  const r = await call(user, panel, '保存为草稿', fields || {})
  const no = r.data?.['编号'] || r.data?.['单据编号']
  if (!no) throw new Error(`建草稿失败 ${panel}: ${JSON.stringify(r)}`)
  return no
}

async function main() {
  console.log('══ 规格书漂移 + 四文件弃审 端到端验证(测试账套)══')
  for (const u of ['admin', 'cp', 'chaishanyin', 'liulei']) {
    const me = await login(u)
    console.log(`  登录 ${u} → ${me.realName} isAdmin=${me.isAdmin} factory=${me.factory}`)
  }

  // ── 1. 产品信息表:建单(带产品编号) → 提交审批 → admin 一级(选 cp 为二级) → cp 二级签核 → 已归档 ──
  const piNo = await newDraft('admin', 'RD_PROD_INFO', { 产品编号: PRODUCT, 产品名称: PNAME })
  await call('admin', 'RD_PROD_INFO', '提交', { 编号: piNo, 产品编号: PRODUCT, 产品名称: PNAME })
  const piProd = await fieldOf('admin', 'RD_PROD_INFO', piNo, '产品编号')
  let r = await call('admin', 'RD_PROD_INFO', '提交审批', { 编号: piNo })
  const rL1 = await call('admin', 'RD_PROD_INFO', '审批通过', { 编号: piNo, 二级审批人: 'cp' })
  const rL2 = await call('cp', 'RD_PROD_INFO', '审批通过', { 编号: piNo })
  check('1 产品信息表走到已归档(产品编号已落库)',
    '产品编号=P-SDRIFT-01;一级/二级都 code=200',
    piProd === PRODUCT && rL1.code === 200 && rL2.code === 200,
    `PI=${piNo} 产品编号=「${piProd}」 提交 code=${r.code} 一级 code=${rL1.code}(msg「${rL1.msg}」) 二级 code=${rL2.code}(msg「${rL2.msg}」)`)

  // ── 2. 分发责任人:规格书→cp,成型工艺清单/组装工艺清单/出货检验计划→chaishanyin ──
  r = await call('admin', 'RD_PROD_INFO', '分发责任人', {
    编号: piNo,
    分发责任人: { RD_SPEC_DOC: 'cp', RD_MOLD_PROC: 'chaishanyin', RD_ASM_PROC: 'chaishanyin', RD_INSP_PLAN: 'chaishanyin' },
  })
  check('2 分发责任人', 'code=200 且四路都有责任人',
    r.code === 200 && r.data?.assigns && Object.keys(r.data.assigns).length >= 4,
    `code=${r.code} msg=「${r.msg}」 assigns=${JSON.stringify(r.data?.assigns || {})}`)

  // ── 3. 规格书:建单 → 规格书分发盖章(rd_spec_assign + 产品编号) → 归档 ──
  const sdNo = await newDraft('admin', 'RD_SPEC_DOC', { 产品编号: PRODUCT })
  const rAssign = await call('admin', 'RD_PROD_INFO', '规格书分发', { 编号: piNo, assigns: [{ 编号: sdNo, 责任人: 'cp' }] })
  r = await call('admin', 'RD_SPEC_DOC', '提交', { 编号: sdNo })
  const sdStatus = await fieldOf('admin', 'RD_SPEC_DOC', sdNo, '单据状态')

  // ── 4. 成型工艺清单:建单 → 归档(admin 归档;责任人只用于后面的弃审验证) ──
  const mpNo = await newDraft('admin', 'RD_MOLD_PROC', { 产品编号: PRODUCT, 产品名称: PNAME })
  r = await call('admin', 'RD_MOLD_PROC', '提交', { 编号: mpNo, 产品编号: PRODUCT, 产品名称: PNAME })
  const mpStatus = await fieldOf('admin', 'RD_MOLD_PROC', mpNo, '单据状态')
  check('3 规格书 + 成型工艺清单都已归档',
    '规格书状态=已归档 且 清单状态=已归档',
    sdStatus === '已归档' && mpStatus === '已归档',
    `规格书 SD=${sdNo} 状态=「${sdStatus}」(分发 code=${rAssign.code} msg「${rAssign.msg}」);清单 MP=${mpNo} 状态=「${mpStatus}」(code=${r.code} msg「${r.msg}」)`)

  // ── 5. 引用单在规格书之后归档 ⇒ 不该提示(不误报) ──
  let dr = await driftOf('chaishanyin', 'RD_MOLD_PROC', mpNo)
  let d = dr.data || {}
  check('4 规格书先归档、清单后归档 ⇒ 不提示(不误报)', 'applicable=true 且 needCheck=false',
    d.applicable === true && d.needCheck === false,
    `HTTP=${dr.http} code=${dr.code} applicable=${d.applicable} needCheck=${d.needCheck} specNo=${d.specNo} specStatus=${d.specStatus}${d.applicable === undefined ? ' 原始响应=' + dr.raw : ''}`)

  // ── 6. 规格书申请修改 ⇒ 引用单必须提示 ──
  r = await call('cp', 'RD_SPEC_DOC', '申请修改', { 编号: sdNo, 修改原因: '验证:改检验要求' })
  dr = await driftOf('chaishanyin', 'RD_MOLD_PROC', mpNo)
  d = dr.data || {}
  check('5 规格书申请修改后 ⇒ 引用单提示(needCheck=true / reason=spec_in_flux)',
    '申请修改 code=200 且 needCheck=true 且 reason=spec_in_flux',
    r.code === 200 && d.needCheck === true && d.reason === 'spec_in_flux',
    `申请修改 code=${r.code} msg=「${r.msg}」;needCheck=${d.needCheck} reason=${d.reason} specNo=${d.specNo} specStatus=「${d.specStatus}」`)

  // ── 7. 引用单责任人(无审批权)弃审 ⇒ 放宽后应放行 ──
  r = await call('chaishanyin', 'RD_MOLD_PROC', '弃审', { 编号: mpNo })
  const ownerUnauditOk = r.code === 200
  check('6 责任人(chaishanyin)弃审引用单 ⇒ 放行', 'code=200(改动前是 403「当前角色无该面板「审批」权限」)',
    ownerUnauditOk, `code=${r.code} msg=「${r.msg}」`)

  // ── 8. 非责任人非审批人(liulei)弃审 ⇒ 仍被拒 ──
  if (ownerUnauditOk) await call('admin', 'RD_MOLD_PROC', '提交', { 编号: mpNo, 产品编号: PRODUCT, 产品名称: PNAME })
  r = await call('liulei', 'RD_MOLD_PROC', '弃审', { 编号: mpNo })
  check('7 非责任人(liulei)弃审 ⇒ 仍被拒', 'code!=200 且提示只有该文件责任人/管理员可以',
    r.code !== 200 && /责任人|管理员|审批权限/.test(String(r.msg)),
    `liulei 弃审 code=${r.code} msg=「${r.msg}」`)

  console.log(`\n结论:PASS=${PASS} FAIL=${FAIL}`)
  console.log('清场:cd tools; $env:YINJIA_SQL_DB="HSDZ_MES_TEST"; java -cp lib\\mssql-jdbc.jar DbSync.java run cleanup-rd-testledger-20261016.sql')
  if (FAIL) process.exitCode = 1
}

main().catch((e) => { console.error('探针异常:', e); process.exit(2) })
