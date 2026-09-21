/**
 * _probe-change-gate.cjs —— 产品变更申请单(RD_CHANGE)「按部门按格编辑门禁」验收(2026-09-21)
 *
 * 用户口径(第③条):各部门按账号分工填本部门栏目,每人只能改自己填写的内容,
 * 「变更后内容」是可编辑区。部门行 = 纸面 7 个预置行(开发部/成型工艺科/组装车间/
 * 销售部/品质部/计划组/仓管部),账号按 yj_user.dept_id → yj_change_dept 映射绑定。
 *
 * 探针钉十件事:
 *   ① 建单即预置 7 个部门行(顺序=纸面顺序,表区=部门评审意见);
 *   ② 非本部门行不可改:cp(产品开发部)改不动 品质部 行(库里保持原值);
 *   ③ 本部门行可写:「开发部」行内容落库;
 *   ④ 签字/日期 由服务端盖章(签字=填写人姓名,日期=今天),前端改不动(还原);
 *   ⑤ 越权改「部门」列被还原(cp 想把 开发部 行改成 品质部 → 仍是 开发部,且不新增行);
 *   ⑥ 载荷省略其它部门行不会被软删(防"省略即删除");
 *   ⑦ 载荷里出现非预置部门行(财务部)→ 拒绝并提示;
 *   ⑧ 同部门另一账号(glm53)可继续填本部门行,签字换成他;
 *   ⑨ 无部门账号(探针建号 dept_id=NULL)改不动任何部门行;
 *   ⑩ 从未填写的部门行不盖章(内容/签字/日期 全空);全程单据状态仍是草稿。
 *
 * 已知引擎口径(不是本功能的缺陷,故不测"清空"):labelsToCols 把空串归一化成 null 并跳过,
 * 因此**任何面板的文本列都不能靠保存置空**(空串=不改动);要撤掉某部门已填内容只能改写它。
 *
 * 用法:node tools/archive/_probe-change-gate.cjs   (需后端 8090;跑完写清理 SQL,再手工执行)
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const TOOLS = path.join(__dirname, '..')
const URL = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10'
const CLEANUP = path.join(__dirname, '_probe-change-gate-cleanup.sql')
const NO_DEPT_USER = 'probe-nodept'
const SECT = '部门评审意见'
const ROWS7 = ['开发部', '成型工艺科', '组装车间', '销售部', '品质部', '计划组', '仓管部']
const TODAY = new Date().toISOString().slice(0, 10)

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)

/** 用 repo 自带的 SqlRunner 读库(免驱动);返回按行解析后的对象数组 */
function sqlRows(name, sql) {
  const f = path.join(__dirname, name + '.sql')
  const out = path.join(__dirname, name + '.out.txt')
  fs.writeFileSync(f, sql, 'utf8')
  const fd = fs.openSync(out, 'w')
  spawnSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
    URL, 'yinjia', 'Yinjia@2026', 'archive\\' + name + '.sql'], { cwd: TOOLS, stdio: ['ignore', fd, fd] })
  fs.closeSync(fd)
  const txt = fs.readFileSync(out, 'utf8')
  if (/\[SQL FAIL\]|\[FATAL\]/.test(txt)) throw new Error('SQL 失败:' + txt.split('\n').filter((l) => /FAIL|FATAL/.test(l)).join(' '))
  return txt.split('\n').filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((x) => x.trim()))
}

async function main() {
  const tok = async (u, p = '123456') => {
    const r = await (await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p }),
    })).json()
    if (!r?.data?.token) throw new Error(u + ' 登录失败:' + JSON.stringify(r))
    return { token: r.data.token, user: r.data.user }
  }
  const api = (t) => {
    const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${t}` }
    return {
      btn: async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
        method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
      })).json()),
      get: async (p) => (await (await fetch(BASE + p, { headers: H })).json()),
      post: async (p, body) => (await (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()),
    }
  }

  const admin = await tok('admin')
  const cp = await tok('cp')
  const glm = await tok('glm53')
  const A = api(admin.token), C = api(cp.token), G = api(glm.token)

  // 无部门账号(幂等:已存在则更新为无部门 + 重置密码)
  const users = (await A.get('/api/sys/user/list'))?.data || []
  const exist = users.find((u) => u.userName === NO_DEPT_USER)
  await A.post('/api/sys/user/save', {
    id: exist?.id, userName: NO_DEPT_USER, realName: '探针无部门', password: '123456',
    deptId: null, roleId: 2, enabled: 1,
  })
  const nd = await tok(NO_DEPT_USER)
  const N = api(nd.token)

  // 单据行(id/部门/表区/变更后内容/签字/日期/备注/存活)
  const rowsOf = (no) => sqlRows('_probe-change-gate-q', `SET NOCOUNT ON;
SELECT CAST(id AS nvarchar(20)) AS id, 部门, 表区, ISNULL(变更后内容,'') AS c, ISNULL(签字,'') AS g,
       ISNULL(日期,'') AS d, ISNULL(备注,'') AS r, CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 'C' ELSE 'L' END AS live
  FROM rd_change_detail WHERE 单据编号 = N'${no}' ORDER BY rd_change_detail.id;`)
    .map(([id, dept, sect, c, g, d, r, live]) => ({ id, dept, sect, c, g, d, r, live }))
  const live = (rs) => rs.filter((x) => x.live === 'L')
  const rowIn = (rs, dept) => live(rs).find((x) => x.dept === dept)
  const item = (r) => ({ id: r.id, 表区: SECT, 部门: r.dept, 变更后内容: r.c, 签字: r.g, 日期: r.d, 备注: r.r })
  const save = (API, no, rows, btn = '保存为草稿') => API.btn('RD_CHANGE', btn, { 编号: no, detail: { items: rows } })

  // ════ ① 建单 → 7 个预置部门行 ════
  step('① 建单:预置 7 个部门行')
  const draft = await A.btn('RD_CHANGE', '保存为草稿', {})
  const no = draft?.data?.['编号']
  if (!no) throw new Error('建产品变更申请单失败:' + JSON.stringify(draft))
  let rs = rowsOf(no)
  const depts = live(rs).map((x) => x.dept)
  console.log('     部门行 = ' + JSON.stringify(depts))
  if (JSON.stringify(depts) === JSON.stringify(ROWS7)) ok('7 个预置部门行齐、顺序=纸面顺序')
  else bad(`预置部门行不符:${JSON.stringify(depts)}`)
  if (live(rs).length === 7 && live(rs).every((x) => x.sect === SECT)) ok('各行 表区 = ' + SECT)
  else bad('表区不符:' + JSON.stringify(live(rs).map((x) => x.sect)))

  // ════ ②③④ 越权/本部门/盖章 ════
  step('② 管理员先给 品质部 行写 Q0')
  const q0 = rowIn(rs, '品质部')
  await save(A, no, [item({ ...q0, c: 'Q0' })])
  if (rowIn(rowsOf(no), '品质部')?.c === 'Q0') ok('品质部 = Q0(管理员可写)')
  else bad('管理员写品质部失败')

  step('③ cp(产品开发部)写 开发部 行 + 越权改 品质部 行')
  rs = rowsOf(no)
  const dev = rowIn(rs, '开发部')
  const r1 = await save(C, no, [
    { id: dev.id, 表区: SECT, 部门: '开发部', 变更后内容: 'A1', 签字: '伪造签名', 日期: '1999-01-01', 备注: '本部门备注' },
    { id: q0.id, 表区: SECT, 部门: '品质部', 变更后内容: 'Q1', 备注: '越权备注' },
  ])
  if (r1?.code === 200) ok('cp 保存通过')
  else bad('cp 保存失败:' + JSON.stringify(r1))
  rs = rowsOf(no)
  const dev2 = rowIn(rs, '开发部'), q2 = rowIn(rs, '品质部')
  if (dev2?.c === 'A1') ok('本部门行内容落库:开发部 = A1')
  else bad(`开发部内容不符:${dev2?.c}`)
  if (q2?.c === 'Q0') ok('非本部门行被还原:品质部 仍是 Q0(载荷里的 Q1 未生效)')
  else bad(`品质部被越权改写:${q2?.c}`)
  if (q2?.r === '') ok('非本部门行备注也被还原:品质部备注为空')
  else bad(`品质部备注被越权改写:${q2?.r}`)
  if (dev2?.r === '本部门备注') ok('本部门行备注可写:开发部备注 = 本部门备注')
  else bad(`本部门备注未落库:${dev2?.r}`)
  if (dev2?.g === '陈秀丽' && dev2?.d === TODAY) ok(`签字/日期 服务端盖章:${dev2.g} / ${dev2.d}(载荷里的伪造签名被覆盖)`)
  else bad(`盖章不符:签字=${dev2?.g} 日期=${dev2?.d}(应 陈秀丽 / ${TODAY})`)

  // ════ ⑤ 越权改「部门」列 ════
  step('⑤ cp 想把 开发部 行改成 品质部(改「部门」列)')
  await save(C, no, [{ id: dev.id, 表区: SECT, 部门: '品质部', 变更后内容: 'A2' }])
  rs = rowsOf(no)
  if (rowIn(rs, '开发部')?.c === 'A2') ok('行仍在 开发部 名下,内容已更新为 A2')
  else bad(`部门列未还原:${JSON.stringify(live(rs).map((x) => [x.dept, x.c]))}`)
  if (live(rs).filter((x) => x.dept === '品质部').length === 1) ok('未凭空多出 品质部 行(仍是 1 行)')
  else bad('品质部 行数异常:' + live(rs).filter((x) => x.dept === '品质部').length)

  // ════ ⑥ 省略其它行不软删 ════
  step('⑥ cp 只提交 开发部 一行(省略其它 6 行)')
  await save(C, no, [{ id: dev.id, 表区: SECT, 部门: '开发部', 变更后内容: 'A3' }])
  rs = rowsOf(no)
  if (live(rs).length === 7) ok('其余 6 行仍存活(7 行齐),未被"省略即删除"')
  else bad(`行数异常:存活 ${live(rs).length} 行 / 共 ${rs.length} 行`)

  // ════ ⑦ 非预置部门行被拒 ════
  step('⑦ 载荷里出现非预置部门行(财务部)')
  const r7 = await save(C, no, [{ 表区: SECT, 部门: '财务部', 变更后内容: 'X' }])
  if (r7?.code !== 200 && /部门/.test(String(r7?.message))) ok(`被拒:${r7.message}`)
  else bad(`非预置部门行不该被接受,实际 code=${r7?.code} msg=${r7?.message}`)
  if (live(rowsOf(no)).length === 7) ok('拒单未污染数据(仍 7 行)')
  else bad('拒单后行数异常')

  // ════ ⑧ 同部门另一账号 ════
  step('⑧ 同部门账号 glm53 接力填 开发部 行')
  const r8 = await save(G, no, [{ id: dev.id, 表区: SECT, 部门: '开发部', 变更后内容: 'G1' }])
  rs = rowsOf(no)
  const dev3 = rowIn(rs, '开发部')
  if (r8?.code === 200 && dev3?.c === 'G1') ok('同部门(产品开发部)账号可填:开发部 = G1')
  else bad(`同部门账号填写失败:code=${r8?.code} 内容=${dev3?.c}`)
  if (dev3?.g === '彭于晏') ok('签字随最后填写人:彭于晏')
  else bad(`签字未更新:${dev3?.g}`)

  // ════ ⑨ 无部门账号改不动 ════
  step('⑨ 无部门账号(' + NO_DEPT_USER + ')改 开发部 行')
  const r9 = await save(N, no, [{ id: dev.id, 表区: SECT, 部门: '开发部', 变更后内容: 'N1' }])
  rs = rowsOf(no)
  const dev4 = rowIn(rs, '开发部')
  if (dev4?.c === 'G1') ok(`无部门账号改不动(仍是 G1),接口应答 code=${r9?.code}`)
  else bad(`无部门账号越权写入:${dev4?.c}`)

  // ════ ⑩ 未填行不盖章 + 状态仍草稿 ════
  step('⑩ 从未填写的部门行(计划组)不带签字/日期')
  const plan = rowIn(rowsOf(no), '计划组')
  if ((plan?.c || '') === '' && plan?.g === '' && plan?.d === '') ok('未填行:内容/签字/日期 全空(没有凭空盖章)')
  else bad(`未填行盖章异常:内容=${plan?.c} 签字=${plan?.g} 日期=${plan?.d}`)
  const desc = await A.get(`/api/px/getFormDescriptor?panelCode=RD_CHANGE&code=${encodeURIComponent(no)}`)
  const status = desc?.data?.data?.['单据状态']
  if (status === '草稿') ok('全程单据状态仍是草稿:' + status)
  else bad('单据状态异常:' + status)

  fs.writeFileSync(CLEANUP, `/* 探针清理:产品变更申请单按部门门禁验收(_probe-change-gate.cjs) */
USE HSDZ_MES; SET NOCOUNT ON;
DELETE FROM yj_message      WHERE 单据编号 = N'${no}';
DELETE FROM yj_doc_status   WHERE panel_code = N'RD_CHANGE' AND doc_no = N'${no}';
DELETE FROM rd_change_detail WHERE 单据编号 = N'${no}';
DELETE FROM rd_change_head   WHERE 单据编号 = N'${no}';
DELETE FROM yj_user WHERE username = N'${NO_DEPT_USER}';
SELECT N'变更单残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_change_head WHERE 单据编号 = N'${no}';
`, 'utf8')
  console.log(`\n  --   清理 SQL:${CLEANUP}(单号 ${no} / 探针账号 ${NO_DEPT_USER})`)
  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
