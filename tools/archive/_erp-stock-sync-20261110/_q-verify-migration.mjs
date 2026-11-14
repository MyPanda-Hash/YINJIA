import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
for (const db of ["HSDZ_MES","HSDZ_MES_TEST"]) {
  const pool = await mssql.connect({server:base.server,port:base.port,database:db,user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
  const r = (await pool.request().query(`SELECT c.name AS 列, c.is_computed AS 计算列, CAST(ep.value AS nvarchar(120)) AS 注明
    FROM sys.columns c LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description'
    WHERE c.object_id=OBJECT_ID('dbo.kucun') AND c.name IN (N'金蝶数量',N'差异数量',N'金蝶同步时间')`)).recordset;
  console.log(`### ${db}`);
  for (const x of r) console.log(`  ${x.列} | computed=${x.计算列} | ${String(x.注明||'').slice(0,50)}`);
  const t = (await pool.request().query(`SELECT (SELECT COUNT(*) FROM dbo.erp_stock_snapshot) AS snap, (SELECT COUNT(*) FROM dbo.erp_stock_sync_log) AS log, (SELECT COUNT(*) FROM dbo.yj_translation WHERE ref_key IN (N'金蝶数量',N'差异数量',N'金蝶同步时间')) AS trans`)).recordset;
  console.log(`  表:snapshot=${t[0].snap} log=${t[0].log} 译名=${t[0].trans}`);
  await pool.close();
}
