import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
const pool = await mssql.connect({server:base.server,port:base.port,database:"HSDZ_MES",user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
const r = (await pool.request().query(`SELECT TOP 2 批次号,金蝶行数,覆盖行数,新增行数,清零行数,一致行数,差异合计,状态 FROM dbo.erp_stock_sync_log ORDER BY id DESC`)).recordset;
for (const x of r) console.log(JSON.stringify(x));
const s = (await pool.request().query(`SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(yl,0)<0 THEN 1 ELSE 0 END) AS 负行, CAST(SUM(ISNULL(yl,0)) AS decimal(18,2)) AS 合计 FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y'`)).recordset;
console.log("kucun:", JSON.stringify(s[0]));
await pool.close();
