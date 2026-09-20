// 一次性探针:候选基础资料面板的可用字段(供 yj_field.ref_panel/ref_field/display_field 选择)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

const REFS = ['GFDA', 'KHDA', 'PARTNER', 'DEPT', 'EMP', 'YWYDA', 'WH', 'CKDA', 'INV', 'CUR', 'UOM', 'PROJ', 'SETTLE', 'TEAM', 'FIN_TAX'];
for (const rc of REFS) {
  const rows = await q(`SELECT label, col_name, data_type, seq FROM yj_field WHERE panel_code=N'${rc}' ORDER BY seq`);
  let n = '-';
  try { n = (await q(`SELECT COUNT(*) n FROM ${(await q(`SELECT line_table t FROM yj_panel WHERE panel_code=N'${rc}'`))[0]?.t || 'x'}`))[0].n; } catch {}
  console.log(`${rc} (${n} 行): ` + rows.slice(0, 12).map((r) => `${r.label}[${r.col_name}/${r.data_type}]`).join(' , '));
}
console.log('\n=== qc_insp.暂收单号 实际取值 ===');
for (const r of await q("SELECT 单据编号, 暂收单号, 供应商, 采购订单号 FROM qc_insp WHERE 暂收单号 IS NOT NULL AND 暂收单号<>''")) console.log('  ', JSON.stringify(r));
console.log('=== sl_recv / qc_recv 单号 ===');
for (const t of ['sl_recv', 'qc_recv']) {
  try { console.log(' ', t, JSON.stringify((await q(`SELECT TOP 8 单据编号 FROM ${t}`)).map(x => x.单据编号))); } catch (e) { console.log(' ', t, e.message); }
}
console.log('\n=== 相关列取值样例(代码 or 名称)===');
for (const [t, cols] of [['bd_purchase_in', ['供应商编码', '供应商', '仓库', '经手人']], ['bd_sale_out', ['客户', '结算客户', '经手人', '仓库']], ['bd_pu_order', ['供应商', '币种']], ['bd_so_order', ['客户', '部门', '业务员']], ['sl_recv', ['供应商代码', '供应商', '业务员', '物料编码']], ['qc_return', ['供应商', '物料编码']], ['qc_insp', ['供应商', '物料编码', '暂收单号']]]) {
  const r = (await q(`SELECT TOP 3 * FROM ${t}`))[0];
  if (!r) continue;
  console.log(`  ${t}: ` + cols.map((c) => `${c}=${JSON.stringify(r[c])}`).join(', '));
}
await pool.close();
