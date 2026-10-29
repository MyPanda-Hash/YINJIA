/**
 * _q-bom-sync2.mjs —— 端到端 v2:走**完整审批流**到「已归档」,再验 BOM 同步
 * 用法: node _q-bom-sync2.mjs [base]
 *
 * v1 失败原因:保存只是「审批中」(pending=Y),没归档 ⇒ markArchived 没跑 ⇒ 同步没触发。
 *   这不是缺陷,是我验证方法不对。本版按真实流程走:
 *     新建 → 保存 → 提交审批(选二级审核人)→ 一级审批通过 → 二级审批通过 → 已归档。
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { execFileSync } = require('node:child_process')
const fs = await import('node:fs/promises')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const PROD = 'ZZ-SYNC-02'
const out = []
const log = (k, v) => { out.push({ k, v }); console.log(k, '=', typeof v === 'object' ? JSON.stringify(v) : v) }

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

async function call(buttonName, formData, buttonParam = {}) {
  const r = await (await fetch(BASE + '/api/px/callButton', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName, formData, buttonParam }),
  })).json()
  return r
}

// 预清理
q(`DELETE FROM mate WHERE m_no='${PROD}';
   UPDATE rd_prod_info_head SET asp_cancel='Y' WHERE 产品编号='${PROD}';
   UPDATE rd_prod_info_detail SET asp_cancel='Y' WHERE 单据编号 IN (SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号='${PROD}');`)

/** 建单 → 保存 → 提交审批 */
async function buildDoc(bom) {
  const mk = await call('提交', {})
  const no = String(mk?.data?.['编号'] || '')
  if (!no) throw new Error('新建失败: ' + JSON.stringify(mk).slice(0, 200))
  const sv = await call('保存', {
    编号: no, 产品编号: PROD, 产品名称: '同步验证件', 单据日期: '2026-10-29',
    detail: { items: bom },
  })
  return { no, sv }
}
function status(no) {
  return q(`SELECT ISNULL(archived,'N') AS archived, ISNULL(pending,'N') AS pending FROM yj_doc_status WHERE panel_code='RD_PROD_INFO' AND doc_no='${no}'`)
}

// ── 第一次:保存 → 归档 ──
const d1 = await buildDoc([
  { 序号: '1', 物料编号: 'ZZ-A', 物料名称: '子件甲', 尺寸规格: 'Φ10*20', 数量: '2' },
  { 序号: '2', 物料编号: 'ZZ-B', 物料名称: '子件乙', 尺寸规格: 'Φ12*30', 数量: '3' },
])
log('建单1', d1.no)
log('保存1', JSON.stringify(d1.sv).slice(0, 120))
log('状态1(保存后)', status(d1.no))
log('mate(保存后,应为空)', q(`SELECT COUNT(*) AS n FROM mate WHERE m_no='${PROD}'`))

// 提交审批:RD_PROD_INFO 一级通过时要选二级审核人
log('提交审批1', JSON.stringify(await call('提交审批', { 编号: d1.no }, {})).slice(0, 200))
log('状态1(提交后)', status(d1.no))

// 一级审批通过(要带二级审批人账号)
log('一级审批1', JSON.stringify(await call('审批通过', { 编号: d1.no, 二级审批人: 'admin' }, {})).slice(0, 200))
log('状态1(一级后)', status(d1.no))
// 二级审批通过
log('二级审批1', JSON.stringify(await call('审批通过', { 编号: d1.no }, {})).slice(0, 200))
await new Promise((r) => setTimeout(r, 900))
log('状态1(二级后)', status(d1.no))
log('mate(第一次归档后)', q(`SELECT m_no, wzdm1, wzmc1, wzdm2, wzmc2, gg2, bzl FROM mate WHERE m_no='${PROD}' ORDER BY wzdm2`))

await fs.writeFile(new URL('./out-bom-sync2.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8')
