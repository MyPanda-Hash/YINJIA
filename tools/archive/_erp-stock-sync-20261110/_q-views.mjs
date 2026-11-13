import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
const pool = await mssql.connect({server:base.server,port:base.port,database:"HSDZ_MES",user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
const q = async (s) => (await pool.request().query(s)).recordset;
for (const v of ["v_stock_balance","v_stock_kucun","v_stock_summary"]) {
  const d = await q(`SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.${v}')) AS d`);
  console.log(`\n===== ${v} =====\n${String(d[0].d||'').slice(0, 900)}`);
}
console.log("\n— kucun 现状 —");
for (const r of await q(`SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(yl,0)<0 THEN 1 ELSE 0 END) AS 负行,
  CAST(SUM(ISNULL(yl,0)) AS decimal(18,2)) AS 合计,
  SUM(CASE WHEN [金蝶数量] IS NULL THEN 1 ELSE 0 END) AS 无金蝶数,
  SUM(CASE WHEN ABS(ISNULL(差异数量,0))>0.0001 THEN 1 ELSE 0 END) AS 有差异行,
  SUM(CASE WHEN lot_no=N'PC0000' THEN 1 ELSE 0 END) AS PC0000行 FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y'`)) console.log(JSON.stringify(r));
console.log("\n— 两个口径合计 —");
for (const r of await q(`SELECT (SELECT CAST(SUM(ISNULL(现存量,0)) AS decimal(18,2)) FROM v_stock_balance) AS 库存状况表,
  (SELECT CAST(SUM(ISNULL(yl,0)) AS decimal(18,2)) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS 库存状况kucun`)) console.log(JSON.stringify(r));
await pool.close();
