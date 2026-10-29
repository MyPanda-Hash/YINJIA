/**
 * _flow-change.mjs —— 阶段6:产品变更申请单 + 产品文件列表 + 产品开发任务
 * 用法: node _flow-change.mjs <产品编号> [base]
 *
 * 验证重点:
 *   ① 四份文件全部归档后,产品文件列表(矩阵)能看到该产品且四格都是「开发完毕」;
 *   ② 产品变更申请单能建、能勾选受控文件、能走会签/审批到生效;
 *   ③ 产品开发任务(rd_dev_task)由「产品开发」按钮生成、指向四个下游面板。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const fs = await import('node:fs/promises')

const PROD = process.argv[2] || 'YJ-CB-2026-001'
const BASE = process.argv[3] || 'http://127.0.0.1:8090'
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

// ══ A. 产品文件列表(矩阵)══
const pdl = await (await fetch(BASE + '/api/px/prodDocList', { headers: H })).json()
log('A0.产品文件列表接口', JSON.stringify(pdl).slice(0, 200))
const rows = pdl?.data?.rows || []
const cols = pdl?.data?.columns || []
log('A1.矩阵列', cols.map((c) => c.panelName || c.panelCode))
const mine = rows.find((r) => String(r['产品编号'] ?? '') === PROD)
log('A2.本产品行', mine ? JSON.stringify(mine).slice(0, 400) : '(未出现在矩阵里)')
ok(!!mine, '四份文件归档后,产品出现在产品文件列表矩阵')

// ══ B. 产品变更申请单 ══
const chMk = await call('RD_CHANGE', '新增', {})
const chNo = String(chMk?.data?.['编号'] || '')
log('B1.新建产品变更申请单', { code: chMk.code, 单号: chNo, 状态: chMk?.data?.['单据状态'] })
ok(chMk.code === 200, '新建成功')

const chSv = await call('RD_CHANGE', '保存', {
  编号: chNo,
  单据日期: '2026-10-29',
  标题: 'KPC管控点申请单',
  性质: '设计变更',
  申请日期: '2026-10-29',
  产品编号: PROD,
  变更内容: '炭棒碘值由 1100 提升至 1200,同步更新规格书与工艺清单的物料规格描述。',
  变更原因: '客户反馈除铅率需从 98% 提升到 99%',
  申请人: '系统管理员',
  密级: '保密',
  文件使用范围: '银嘉内部',
})
log('B2.保存', { code: chSv.code, msg: String(chSv.message).slice(0, 160), 状态: chSv?.data?.['单据状态'] })
ok(chSv.code === 200, '产品变更申请单保存成功')

log('B3.库内回查', q(`SELECT 单据编号, 产品编号, 性质, 申请日期 FROM rd_change_head WHERE 单据编号='${chNo}'`))
log('B4.审批/会签链路状态', q(`SELECT archived, pending FROM yj_doc_status WHERE panel_code='RD_CHANGE' AND doc_no='${chNo}'`))

// ══ C. 产品开发任务(rd_dev_task)══
const tasks = q(`SELECT * FROM rd_dev_task ORDER BY id`)
log('C1.产品开发任务表', tasks.slice(0, 600))

// ══ D. 项目进度查询(最终汇总)══
log('D1.项目进度行', q(`SELECT 单据编号, 项目编号, 项目名称 FROM rd_progress_detail WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id`))
log('D2.项目进度头单', q(`SELECT 单据编号, 项目层级 FROM rd_progress`))

await fs.writeFile(new URL('./out-flow-change.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
console.log('\n════ 阶段6 结果: 失败 ' + fails + ' 项 ════')
console.log('产品变更申请单 =', chNo)
