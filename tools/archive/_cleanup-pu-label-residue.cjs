/**
 * _cleanup-pu-label-residue.cjs — 清掉探针残留的送料暂收单(测试账套)。
 * 之所以要单独一个脚本:失败/中断的探针跑可能**没走到清理**(如多张分组生单只记了第一张)。
 * 用法:node tools/archive/_cleanup-pu-label-residue.cjs
 */
'use strict'
const { createRequire } = require('node:module')
const mssql = createRequire('D:/jdy-sync/package.json')('mssql')
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const DB = process.env.YJ_DB || 'HSDZ_MES_TEST'
const PREFIXES = ['隔离-%', '弹窗改-%', '对话框改-%']
const N = (v) => (v === null || v === undefined ? null : String(v).trim())

async function main() {
  const pool = await new mssql.ConnectionPool({
    server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  }).connect()
  const like = PREFIXES.map((p) => `r.批次号 LIKE N'${p}'`).join(' OR ')
  const rows = (await new mssql.Request(pool).query(
    `SELECT r.单据编号 no FROM sl_recv r LEFT JOIN yj_doc_status s ON s.panel_code='QC_RECV' AND s.doc_no=r.单据编号
     WHERE (${like}) AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.deleting,'N')<>'Y'`)).recordset
  if (!rows.length) { console.log('无残留暂收单'); await pool.close(); return }

  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token }
  const cb = async (p, b, no) => {
    const j = await (await fetch(API + '/px/callButton', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: p, buttonName: b, formData: { 编号: no }, buttonParam: {} }),
    })).json()
    return `${j.code} ${j.message || ''}`.trim()
  }
  for (const r of rows) {
    const no = N(r.no)
    for (const b of ['弃审', '删除']) console.log(`  QC_RECV ${no} ${b} → ${await cb('QC_RECV', b, no)}`)
  }
  await pool.close()
}
main().catch((e) => { console.error('异常:' + (e && e.message || e)); process.exit(1) })
