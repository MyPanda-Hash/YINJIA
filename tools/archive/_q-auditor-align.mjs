// 一次性探针:审核人(shr)与职员档案(bs_emp)/MES 用户(yj_user)的对齐情况
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

console.log('shr 取值 → 是否在 bs_emp / yj_user:');
for (const r of await q("SELECT shr, COUNT(*) n FROM yj_doc_status WHERE ISNULL(shr,'')<>'' GROUP BY shr ORDER BY n DESC")) {
  const emp = (await q(`SELECT COUNT(*) c FROM bs_emp WHERE 员工名称=N'${r.shr}'`))[0].c;
  let usr = '-';
  try { usr = (await q(`SELECT COUNT(*) c FROM yj_user WHERE real_name=N'${r.shr}' OR user_name=N'${r.shr}'`))[0].c; } catch (e) { usr = 'no-table'; }
  console.log(`  ${String(r.shr).padEnd(10)} 单据 ${String(r.n).padStart(5)} | bs_emp ${emp} | yj_user ${usr}`);
}
console.log('\nyj_user 前 12 个:', JSON.stringify((await q('SELECT TOP 12 user_name, real_name FROM yj_user')).map(r => `${r.user_name}/${r.real_name}`)));
console.log('bs_emp 前 12 个:', JSON.stringify((await q('SELECT TOP 12 员工编码, 员工名称 FROM bs_emp')).map(r => `${r.员工编码}=${r.员工名称}`)));
await pool.close();
