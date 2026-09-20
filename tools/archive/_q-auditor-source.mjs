// 一次性探针:yj_doc_status.shr(审核人)分布 —— 决定「审核人」筛选该走哪个真源
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

console.log('yj_doc_status 有 shr 的行数(按面板 TOP):');
for (const r of await q("SELECT TOP 12 panel_code, COUNT(*) n FROM yj_doc_status WHERE shr IS NOT NULL AND LTRIM(RTRIM(shr))<>'' GROUP BY panel_code ORDER BY n DESC")) {
  console.log(`  ${r.panel_code}: ${r.n}`);
}
console.log('\n七个面板的样例:');
for (const pc of ['PU_ORDER', 'SL_RECV', 'QC_RETURN', 'QC_INSP', 'PURCHASE_IN', 'SO_ORDER', 'SALE_OUT']) {
  const rows = await q(`SELECT TOP 3 doc_no, shr, shsj FROM yj_doc_status WHERE panel_code=N'${pc}' AND shr IS NOT NULL ORDER BY shsj DESC`);
  console.log(`  ${pc}: ${JSON.stringify(rows)}`);
}
console.log('\nshr 取值 TOP:', JSON.stringify((await q("SELECT TOP 8 shr v, COUNT(*) n FROM yj_doc_status WHERE ISNULL(shr,'')<>'' GROUP BY shr ORDER BY n DESC")).map(r => `${r.v}(${r.n})`)));
console.log('\nbs_emp 命中率:', JSON.stringify((await q("SELECT COUNT(DISTINCT s.shr) n, COUNT(DISTINCT e.员工名称) hit FROM yj_doc_status s LEFT JOIN bs_emp e ON e.员工名称=s.shr WHERE ISNULL(s.shr,'')<>''"))[0]));
console.log('\n表内 审核人 列有值的行数:');
for (const [t, c] of [['qc_insp', '审核人'], ['qc_return', '审核人'], ['sl_recv', '审核人'], ['bd_purchase_in', '审核人'], ['bd_sale_out', '审核人']]) {
  try { console.log(`  ${t}.${c}: ` + (await q(`SELECT COUNT(*) n FROM ${t} WHERE ISNULL([${c}],'')<>''`))[0].n); } catch (e) { console.log(`  ${t}: 无此列`); }
}
await pool.close();
