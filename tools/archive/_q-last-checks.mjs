// 一次性探针:补齐最后几个待定项(仓库名称字段是否存在/供应商编码存值/计量单位与单位存值)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

console.log('PURCHASE_IN/SALE_OUT 里 label=仓库名称 的字段:');
console.log(JSON.stringify(await q("SELECT panel_code, label, col_name, data_type, ref_panel, ref_field, display_field, place, hidden, seq, id FROM yj_field WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND label=N'仓库名称'"), null, 0));

console.log('\nbd_pu_order.供应商编码 取值:', JSON.stringify((await q("SELECT DISTINCT TOP 6 供应商编码 v FROM bd_pu_order WHERE ISNULL(供应商编码,'')<>''")).map(r => r.v)));
console.log('dm_gf.dm 命中:', JSON.stringify((await q("SELECT COUNT(*) n, SUM(CASE WHEN r.dm IS NOT NULL THEN 1 ELSE 0 END) hit FROM (SELECT DISTINCT 供应商编码 v FROM bd_pu_order WHERE ISNULL(供应商编码,'')<>'') x LEFT JOIN dm_gf r ON r.dm=x.v"))[0]));

console.log('\n计量单位/单位 存值:');
for (const [t, c] of [['sl_recv_detail', '计量单位'], ['sl_recv_detail', '单位'], ['qc_insp_detail', '计量单位'], ['qc_insp_detail', '单位'], ['qc_return_detail', '计量单位'], ['qc_return_detail', '单位']]) {
  try { console.log(`  ${t}.${c}:`, JSON.stringify((await q(`SELECT DISTINCT TOP 8 [${c}] v FROM ${t} WHERE ISNULL([${c}],'')<>''`)).map(r => r.v))); } catch (e) { console.log(`  ${t}.${c}: 列不存在`); }
}
console.log('  UOM(bs_uom) 计量单位名称:', JSON.stringify((await q('SELECT TOP 10 计量单位编码, 计量单位名称 FROM bs_uom')).map(r => `${r.计量单位编码}=${r.计量单位名称}`)));
console.log('  命中统计:', JSON.stringify((await q(`SELECT COUNT(*) n, SUM(CASE WHEN u.计量单位名称 IS NOT NULL THEN 1 ELSE 0 END) hit FROM (SELECT DISTINCT 计量单位 v FROM sl_recv_detail WHERE ISNULL(计量单位,'')<>'' UNION SELECT DISTINCT 计量单位 FROM qc_insp_detail WHERE ISNULL(计量单位,'')<>'' UNION SELECT DISTINCT 计量单位 FROM qc_return_detail WHERE ISNULL(计量单位,'')<>'') x LEFT JOIN bs_uom u ON u.计量单位名称=x.v`))[0]));

console.log('\n物料名称存值(qc 明细):', JSON.stringify((await q("SELECT DISTINCT TOP 5 物料名称 v FROM qc_insp_detail WHERE ISNULL(物料名称,'')<>''")).map(r => r.v)));
console.log('INV.存货名称 命中:', JSON.stringify((await q("SELECT COUNT(*) n, SUM(CASE WHEN i.存货名称 IS NOT NULL THEN 1 ELSE 0 END) hit FROM (SELECT DISTINCT 物料名称 v FROM qc_insp_detail WHERE ISNULL(物料名称,'')<>'' UNION SELECT DISTINCT 物料名称 FROM qc_return_detail WHERE ISNULL(物料名称,'')<>'') x LEFT JOIN bs_inv i ON i.存货名称=x.v"))[0]));
console.log('\nQC_INSP.部门 取值:', JSON.stringify((await q("SELECT DISTINCT TOP 5 部门 v FROM qc_insp_detail WHERE ISNULL(部门,'')<>''")).map(r => r.v)));
await pool.close();
