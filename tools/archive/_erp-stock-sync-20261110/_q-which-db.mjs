import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8").replace(/^\uFEFF/,"")).database;
for (const db of ["HSDZ_MES","HSDZ_MES_TEST"]) {
  const pool = await mssql.connect({server:base.server,port:base.port,database:db,user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
  const q = async (s) => (await pool.request().query(s)).recordset;
  const log = await q(`SELECT TOP 2 批次号,金蝶行数,覆盖行数,一致行数,状态,CONVERT(nvarchar(19),开始时间,120) AS 开始 FROM dbo.erp_stock_sync_log ORDER BY id DESC`);
  const k = (await q(`SELECT COUNT(*) AS 行数, CAST(SUM(ISNULL(yl,0)) AS decimal(18,2)) AS 合计, SUM(CASE WHEN ISNULL(yl,0)<0 THEN 1 ELSE 0 END) AS 负行,
    SUM(CASE WHEN [金蝶同步时间] IS NOT NULL THEN 1 ELSE 0 END) AS 被金蝶写过 FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y'`))[0];
  console.log(`\n### ${db}`);
  console.log(`kucun: ${k.行数} 行 / 合计 ${k.合计} / 负行 ${k.负行} / 有金蝶同步时间 ${k.被金蝶写过}`);
  console.log(`最近同步: ${log.map((x)=>`${x.批次号}(${x.开始}) 金蝶${x.金蝶行数} 覆盖${x.覆盖行数} 一致${x.一致行数} ${x.状态}`).join(" | ") || "(无)"}`);
  await pool.close();
}
