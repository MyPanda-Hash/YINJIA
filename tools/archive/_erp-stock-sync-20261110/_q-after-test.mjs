import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
const pool = await mssql.connect({server:base.server,port:base.port,database:"HSDZ_MES_TEST",user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
const q = async (s) => (await pool.request().query(s)).recordset;
console.log("— kucun 概况 —");
for (const r of await q(`SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(yl,0)<0 THEN 1 ELSE 0 END) AS 负行,
  SUM(CASE WHEN ISNULL(yl,0)=0 THEN 1 ELSE 0 END) AS 零行, CAST(SUM(ISNULL(yl,0)) AS decimal(18,2)) AS 合计,
  SUM(CASE WHEN [金蝶数量] IS NULL THEN 1 ELSE 0 END) AS 无金蝶数列 FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y'`)) console.log(JSON.stringify(r));
console.log("— 负行明细 —");
for (const r of await q(`SELECT TOP 15 id,wzdm,ckdm,lot_no,yl,[金蝶数量],差异数量,asp_user2 FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<0 ORDER BY yl`)) console.log(JSON.stringify(r));
console.log("— 最近日志 —");
for (const r of await q(`SELECT TOP 3 批次号,金蝶行数,覆盖行数,新增行数,清零行数,一致行数,差异合计,状态,错误信息 FROM dbo.erp_stock_sync_log ORDER BY id DESC`)) console.log(JSON.stringify(r));
console.log("— 快照分布 —");
for (const r of await q(`SELECT 处理方式, COUNT(*) AS n, CAST(SUM(金蝶数量) AS decimal(18,2)) AS 金蝶, CAST(SUM(MES原数量) AS decimal(18,2)) AS MES, CAST(SUM(差异数量) AS decimal(18,2)) AS 差异 FROM dbo.erp_stock_snapshot GROUP BY 处理方式`)) console.log(JSON.stringify(r));
await pool.close();
