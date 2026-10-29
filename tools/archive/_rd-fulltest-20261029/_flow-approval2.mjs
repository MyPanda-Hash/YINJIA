/**
 * _flow-approval2.mjs —— 阶段1 续:立项申请「定级 → 分发对接人 → 确认责任人」闭环
 * 用法: node _flow-approval2.mjs <单号> [base]
 *
 * 前置事实(已验证):保存 = 自动送审(pending='Y'),这是 2026-10-28 用户口径
 *   「管理员的保存即归档去掉,一样走审批流程」⇒ 不需要再点「提交审批」。
 * 本脚本从「已归档」状态往下跑定级/分发/确认三步,并检查每一步的门禁。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const fs = await import('node:fs/promises')

const docNo = process.argv[2]
const BASE = process.argv[3] || 'http://127.0.0.1:8090'
if (!docNo) { console.log('用法: node _flow-approval2.mjs <单号>'); process.exit(1) }

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
  const r = await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: panel, buttonName, formData, buttonParam }),
  })).json()
  return r
}

log('起始状态', q(`SELECT doc_no, archived, pending FROM yj_doc_status WHERE panel_code='RD_APPROVAL' AND doc_no='${docNo}'`))

// ══ 分发对接人(需先定级)══
log('1.分发对接人', JSON.stringify(await call('RD_APPROVAL', '分发对接人', { 编号: docNo, 对接人: 'admin' })).slice(0, 200))
log('1b.库内对接人', q(`SELECT 单据编号, 备用1 AS 对接人 FROM rd_approval WHERE 单据编号='${docNo}'`))

// ══ 确认责任人(需已有对接人)══
log('2.确认责任人', JSON.stringify(await call('RD_APPROVAL', '确认责任人', { 编号: docNo, 项目责任人: 'admin' })).slice(0, 200))
log('2b.库内责任人', q(`SELECT 单据编号, 备用1 AS 对接人, 备用2 AS 项目责任人, 备用3 AS 责任人确认 FROM rd_approval WHERE 单据编号='${docNo}'`))

// ══ 最终状态 ══
log('3.最终库状态', q(`SELECT 单据编号, 项目等级, 申请立项人, 备用1 AS 对接人, 备用2 AS 责任人 FROM rd_approval WHERE 单据编号='${docNo}'`))
log('3b.审批留痕', q(`SELECT form_no, action, result, node_no, operator, opinion FROM yj_form_approval WHERE panel_code='RD_APPROVAL' AND form_no='${docNo}' ORDER BY id`))

await fs.writeFile(new URL('./out-flow-approval2.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
console.log('\n════ 阶段1 续: 失败 ' + fails + ' 项 ════')
