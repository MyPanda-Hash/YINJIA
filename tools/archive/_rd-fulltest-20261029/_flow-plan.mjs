/**
 * _flow-plan.mjs —— 阶段2:项目实施计划(建单→填全 10 阶段→审核归档→同步项目进度查询)
 * 用法: node _flow-plan.mjs <立项申请单号> [base]
 *
 * 依赖:立项申请必须已归档且已定级(项目名称/项目定级由它带入,见 ButtonService 同步逻辑)。
 * 验证重点:
 *   ① 建单能带出立项申请的项目名称/定级;
 *   ② 10 个阶段 × 5 字段全部落库;
 *   ③ 归档后**自动同步**到 RD_PROGRESS(项目进度查询)—— 这是用户报过障的点(2026-10-09)。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const fs = await import('node:fs/promises')

const APPROVAL_NO = process.argv[2]
const BASE = process.argv[3] || 'http://127.0.0.1:8090'
if (!APPROVAL_NO) { console.log('用法: node _flow-plan.mjs <立项申请单号>'); process.exit(1) }

const out = []
let fails = 0
const log = (k, v) => { out.push({ step: k, result: v }); console.log('\n── ' + k + ' ──'); console.log(typeof v === 'object' ? JSON.stringify(v, null, 2) : v) }
const ok = (c, m) => { console.log((c ? '  OK   ' : '  FAIL ') + m); if (!c) fails++; return !!c }

function q(sql) {
  return execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib/mssql-jdbc.jar', 'archive/_Query.java',
    'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true',
    'yinjia', 'Yinjia@2026', sql], { cwd: 'C:/INCER/YINJIA-MES/tools', encoding: 'utf8' }).trim()
}
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})
const token = (await lr.json())?.data?.token || ''
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
async function call(panel, buttonName, formData, buttonParam = {}) {
  return await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: panel, buttonName, formData, buttonParam }),
  })).json()
}

// 先从立项申请取文档编号(同步关联键,必须一致)。
// ⚠ _Query 输出两种形状:单列时值独占一行(`YJ-RD-2026-001`),多列时用 ` | ` 拼接。
//   两种都要兼容,否则取不到值 → 文档编号空 → 保存报「文档编号不能为空」。
const APPROVAL_DOC_NO = (q(`SELECT 文档编号 FROM rd_approval WHERE 单据编号='${APPROVAL_NO}'`)
  .split(/\r?\n/)
  .map((s) => s.trim())
  .map((l) => (l.includes('|') ? (l.split('|').pop() || '').trim() : l))
  .filter((l) => /^YJ-/.test(l))[0] || '')
log('立项申请文档编号(同步关联键)', APPROVAL_DOC_NO || '(未取到)')

// 立项申请现状(确认已归档已定级)
log('0.立项申请现状', q(`SELECT 单据编号, 项目等级, ISNULL(asp_cancel,'N') AS 作废 FROM rd_approval WHERE 单据编号='${APPROVAL_NO}'`))

// ══ 1. 新建实施计划 ══
const mk = await call('RD_PLAN', '新增', { 立项申请单号: APPROVAL_NO })
const docNo = String(mk?.data?.['编号'] || '')
log('1.新建', { code: mk.code, msg: mk.message, 单号: docNo, 状态: mk?.data?.['单据状态'], 项目名称: mk?.data?.['项目名称'], 项目定级: mk?.data?.['项目定级'] })
if (!docNo) { await fs.writeFile(new URL('./out-flow-plan.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8'); process.exit(1) }
ok(mk.code === 200, '新建实施计划成功')

// ══ 2. 填全 10 个阶段 ══
const STAGES = [
  ['立项与方案评审', '2026-11-01', '2026-11-10', '需求确认、技术方案评审通过'],
  ['结构设计', '2026-11-11', '2026-11-30', '完成 3D 结构图与装配图'],
  ['样品试制', '2026-12-01', '2026-12-20', '试制 20 支样品'],
  ['性能测试', '2026-12-21', '2027-01-15', '除铅率/余氯/压降三项达标'],
  ['工艺定型', '2027-01-16', '2027-02-10', '成型/组装工艺参数固化'],
  ['小批试产', '2027-02-11', '2027-03-05', '试产 500 支,良率 ≥95%'],
  ['第三方检测', '2027-03-06', '2027-03-25', 'SGS 报告合格'],
  ['文件编制', '2027-03-26', '2027-04-10', '四份受控文件完成'],
  ['文件审批', '2027-04-11', '2027-04-20', '四个文件全部归档受控'],
  ['项目验收', '2027-04-21', '2027-04-30', '项目结项验收'],
]
const plan = {
  编号: docNo,
  // ⚠ 文档编号必须与**立项申请的文档编号一致** —— 同步到项目进度查询的关联键就是它
  //   (syncPlanToProgress: rd_plan JOIN rd_approval ON a.文档编号 = p.文档编号)。
  //   填成别的号会让项目进度查询永远收不到数据(实测踩到)。
  文档编号: APPROVAL_DOC_NO,
  单据日期: '2026-10-29',
  项目名称: '高效除重金属炭棒滤芯开发',
  项目定级: '三级',
  测试内容: '除铅率、余氯去除率、压降、使用寿命四项性能测试',
  测试产品打样要求: '打样 20 支,外观无缺陷、尺寸公差 ±0.5mm',
  测试目标: '除铅率 ≥98%,余氯去除率 ≥95%,压降 ≤0.02MPa',
  测试条件: '水温 25℃、流量 2L/min、进水铅浓度 150ppb',
  测试方法: '按 GB/T 5750 与 NSF42 标准方法检测',
  测试标准: 'GB/T 5750-2023 / NSF/ANSI 42',
  测试计划: '分三批检测:试制批(20支)、试产批(500支抽检)、定型批(抽检)',
  负责人: '系统管理员',
  编制日期: '2026-10-29',
  文件管理人: '系统管理员',
  密级: '保密',
  文件使用范围: '银嘉内部',
}
STAGES.forEach((s, i) => {
  const n = i + 1
  plan['阶段' + n] = s[0]
  plan['阶段' + n + '_计划内容'] = s[3]
  plan['阶段' + n + '_计划开始'] = s[1]
  plan['阶段' + n + '_计划完成'] = s[2]
  plan['阶段' + n + '_责任人'] = '系统管理员'
})
const sv = await call('RD_PLAN', '保存', plan)
log('2.保存(10 阶段)', { code: sv.code, msg: sv.message, 状态: sv?.data?.['单据状态'] })
ok(sv.code === 200, '保存成功')

log('2b.库内回查(前3阶段)', q(`SELECT 阶段1, 阶段1_计划开始, 阶段1_计划完成, 阶段1_责任人, 阶段10, 阶段10_计划内容 FROM rd_plan WHERE 单据编号='${docNo}'`))
const cnt = q(`SELECT COUNT(*) AS 已填阶段 FROM rd_plan WHERE 单据编号='${docNo}' AND 阶段1 IS NOT NULL AND 阶段2 IS NOT NULL AND 阶段5 IS NOT NULL AND 阶段10 IS NOT NULL`)
log('2c.阶段完整性', cnt)
ok(cnt.includes('1'), '10 个阶段都落库了')

// ══ 3. 审批通过(归档)══
log('3.审批通过', JSON.stringify(await call('RD_PLAN', '审批通过', { 编号: docNo, 审批意见: '计划合理,同意执行' })).slice(0, 200))
await new Promise((r) => setTimeout(r, 1200))
log('3b.状态', q(`SELECT archived, pending FROM yj_doc_status WHERE panel_code='RD_PLAN' AND doc_no='${docNo}'`))

// ══ 4. 是否自动同步到项目进度查询(用户 2026-10-09 报过的点)══
// ⚠ 同步写的是 **rd_progress_detail**(进度行),不是 rd_progress 头表
//   (头表是"单单据"汇总单,一行都不存项目 —— 原先查头表所以误判成没同步)。
const prog = q(`SELECT 单据编号, 项目编号, 项目名称, ISNULL(asp_cancel,'N') AS 作废
  FROM rd_progress_detail WHERE 项目编号='${APPROVAL_DOC_NO}' AND ISNULL(asp_cancel,'N') <> 'Y'`)
log('4.项目进度查询(自动同步结果)', prog)
ok(prog.includes(APPROVAL_DOC_NO) && prog.includes('|'), '已自动同步到项目进度查询(进度行存在且未作废)')

await fs.writeFile(new URL('./out-flow-plan.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
console.log('\n════ 阶段2 结果: 失败 ' + fails + ' 项 ════')
console.log('实施计划单号 =', docNo)
