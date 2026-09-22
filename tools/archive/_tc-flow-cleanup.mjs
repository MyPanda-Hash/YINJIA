/**
 * _tc-flow-cleanup.mjs — 清理 _verify-qc-tc-flow.mjs run2 中断残留的测试链(2026-09-22)
 * 只清探针自己造的单据;TCI-2026-09-0004(无检验单号,他人手工测试单)不动。
 */
import { createRequire } from 'node:module';
import { fetchRetry } from './_apifetch.mjs';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();

const lj = await (await fetchRetry(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (url, body) => {
  const j = await (await fetchRetry(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(JSON.stringify(j).slice(0, 200));
  return j.data;
};
const cb = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} });

// 反序:入库草稿 → 特采单 → 检验单(A 链) → B 链检验/暂收 → A 链暂收
const seq = [
  ['PURCHASE_IN', 'PI-2026-09-0103'],
  ['QC_TC_IN', 'TCI-2026-09-0003'],
  ['QC_INSP', 'IJ-2026-09-0107'],
  ['QC_INSP', 'IJ-2026-09-0106'],
  ['QC_RECV', 'SL-2026-09-0120'],
  ['QC_RECV', 'SL-2026-09-0119'],
];
for (const [p, no] of seq) {
  for (const b of ['弃审', '删除']) {
    try { await cb(p, b, { 编号: no }); console.log(`${p} ${no} ${b} OK`); }
    catch (e) { console.log(`${p} ${no} ${b} skip: ${String(e.message).slice(0, 100)}`); }
  }
}
// 终态核对
const st = (await new mssql.Request(pool).query(`
SELECT N'特采单' k, RTRIM(单据编号) d, ISNULL(s.canceled,'N') c FROM qc_tc_in t
 LEFT JOIN yj_doc_status s ON s.panel_code='QC_TC_IN' AND s.doc_no=t.单据编号
WHERE t.单据编号 IN (N'TCI-2026-09-0003', N'TCI-2026-09-0004')
UNION ALL
SELECT N'检验单', RTRIM(单据编号), ISNULL(s.canceled,'N') FROM qc_insp t
 LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=t.单据编号
WHERE t.单据编号 IN (N'IJ-2026-09-0106', N'IJ-2026-09-0107')
UNION ALL
SELECT N'入库单', RTRIM(单据编号), ISNULL(s.canceled,'N') FROM bd_purchase_in t
 LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=t.单据编号
WHERE t.单据编号 = N'PI-2026-09-0103'
UNION ALL
SELECT N'暂收单', RTRIM(单据编号), ISNULL(s.canceled,'N') FROM sl_recv t
 LEFT JOIN yj_doc_status s ON s.panel_code='QC_RECV' AND s.doc_no=t.单据编号
WHERE t.单据编号 IN (N'SL-2026-09-0119', N'SL-2026-09-0120')`)).recordset;
console.log('终态:' + JSON.stringify(st));
await pool.close();
