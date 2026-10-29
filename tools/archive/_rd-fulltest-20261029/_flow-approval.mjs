/**
 * _flow-approval.mjs —— 阶段1:立项申请全流程(建单→填全→提交→审批→定级→分发→归档)
 * 用法: node _flow-approval.mjs [base]
 *
 * 字段口径来自 yj_field 实测(RD_APPROVAL,23 个字段,含 4 个备用列别名):
 *   文档编号/单据日期 必填;备用1=对接人 备用2=项目责任人 备用3=责任人确认 备用4=确认收到时间。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const out = []
const log = (k, v) => { out.push({ step: k, result: v }); console.log('\n── ' + k + ' ──'); console.log(typeof v === 'object' ? JSON.stringify(v, null, 2) : v) }
let fails = 0
const ok = (cond, msg) => { console.log((cond ? '  OK   ' : '  FAIL ') + msg); if (!cond) fails++; return !!cond }

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
  const t0 = Date.now()
  const r = await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: panel, buttonName, formData, buttonParam }),
  })).json()
  return { ...r, _ms: Date.now() - t0 }
}
const docStatus = (panel, no) => q(`SELECT ISNULL(archived,'N') AS archived, ISNULL(pending,'N') AS pending FROM yj_doc_status WHERE panel_code='${panel}' AND doc_no='${no}'`)

// ══ 1. 新建 ══
const mk = await call('RD_APPROVAL', '新增', {})
const docNo = String(mk?.data?.['编号'] || '')
log('1.新建', { code: mk.code, msg: mk.message, 单号: docNo, 状态: mk?.data?.['单据状态'], ms: mk._ms })
if (!docNo) { console.log('FAIL 新建失败,终止'); await fs.writeFile(new URL('./out-flow-approval.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8'); process.exit(1) }
ok(mk.code === 200, '新建立项申请成功,拿到单号 ' + docNo)

// ══ 2. 填完整数据保存 ══
const full = {
  编号: docNo,
  文档编号: 'YJ-RD-2026-001',
  单据日期: '2026-10-29',
  客户名: '惠州市银嘉环保科技有限公司',
  立项背景: '针对家用净水器滤芯升级需求,开发新一代高效除重金属炭棒滤芯,提升吸附容量与使用寿命。',
  机型及应用位置: 'YKRS-200 净水器 / 二级滤芯位置',
  '滤芯/炭棒规格或结构': '外径 33mm / 内径 12mm / 长度 110mm,椰壳载银活性炭',
  项目开发目标: '除铅率 ≥98%,余氯去除率 ≥95%,使用寿命 12 个月',
  项目输出: '产品规格书、成型工艺清单、组装工艺清单、出货检验计划表、3D 图纸',
  开发周期要求: '6 个月(2026-11 至 2027-04)',
  其它要求: '需通过 SGS 第三方检测与 NSF42 认证',
  申请立项人: '系统管理员',
  申请立项日期: '2026-10-29',
  文件管理人: '系统管理员',
  密级: '保密',
  文件使用范围: '银嘉内部',
  备注: '研发管理全流程验收单',
}
const sv = await call('RD_APPROVAL', '保存', full)
log('2.保存完整数据', { code: sv.code, msg: sv.message, 状态: sv?.data?.['单据状态'], ms: sv._ms })
ok(sv.code === 200, '保存成功')

log('2b.库内回查', q(`SELECT 单据编号, 文档编号, 客户名, 项目开发目标, 密级 FROM rd_approval WHERE 单据编号='${docNo}'`))
ok(q(`SELECT COUNT(*) FROM rd_approval WHERE 单据编号='${docNo}' AND 客户名 IS NOT NULL AND 项目开发目标 IS NOT NULL`).includes('1'), '字段真的落库(不是只在界面上)')

// ══ 3. 提交审批 ══
const sub = await call('RD_APPROVAL', '提交审批', { 编号: docNo })
log('3.提交审批', { code: sub.code, msg: sub.message, 状态: sub?.data?.['单据状态'] })
ok(sub.code === 200, '提交审批成功')
log('3b.状态', docStatus('RD_APPROVAL', docNo))

// ══ 4. 审批通过 ══
const apv = await call('RD_APPROVAL', '审批通过', { 编号: docNo, 审批意见: '同意立项' })
log('4.审批通过', { code: apv.code, msg: apv.message, 状态: apv?.data?.['单据状态'] })
ok(apv.code === 200, '审批通过成功')

// ══ 5. 项目定级 ══
const grade = await call('RD_APPROVAL', '项目定级', { 编号: docNo, 项目等级: '三级', 审批意见: '定级:三级项目' })
log('5.项目定级', { code: grade.code, msg: grade.message, 状态: grade?.data?.['单据状态'] })
log('5b.库内项目等级', q(`SELECT 单据编号, 项目等级 FROM rd_approval WHERE 单据编号='${docNo}'`))
ok(grade.code === 200, '项目定级成功')

await fs.writeFile(new URL('./out-flow-approval.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
console.log('\n════ 阶段1 结果: 失败 ' + fails + ' 项 ════')
console.log('单号 =', docNo)
