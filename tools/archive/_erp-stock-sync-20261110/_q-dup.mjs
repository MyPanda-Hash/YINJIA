import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
for (const db of ["HSDZ_MES","HSDZ_MES_TEST"]) {
  const pool = await mssql.connect({server:base.server,port:base.port,database:db,user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
  const r = (await pool.request().query(`SELECT COUNT(*) AS 重复键组数, ISNULL(SUM(n),0) AS 涉及行数 FROM (
      SELECT COUNT(*) AS n FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y'
       GROUP BY wzdm, ckdm, ISNULL(lot_no,'') HAVING COUNT(*) > 1) t`)).recordset;
  console.log(`${db}: 重复键组=${r[0].重复键组数} 涉及行=${r[0].涉及行数}`);
  if (r[0].重复键组数 > 0) {
    const d = (await pool.request().query(`SELECT TOP 5 wzdm, ckdm, ISNULL(lot_no,'') AS lot, COUNT(*) AS n, SUM(yl) AS 合计 FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY wzdm, ckdm, ISNULL(lot_no,'') HAVING COUNT(*)>1`)).recordset;
    for (const x of d) console.log(`   ${x.wzdm}|${x.ckdm}|${x.lot} ×${x.n} 合计=${x.合计}`);
  }
  const s = (await pool.request().query(`SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(yl,0)<0 THEN 1 ELSE 0 END) AS 负行, CAST(SUM(ISNULL(yl,0)) AS decimal(18,2)) AS 合计 FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y'`)).recordset;
  console.log(`   行数=${s[0].行数} 负行=${s[0].负行} 合计=${s[0].合计}`);
  await pool.close();
}
