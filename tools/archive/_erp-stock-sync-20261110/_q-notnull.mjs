import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
const pool = await mssql.connect({server:base.server,port:base.port,database:"HSDZ_MES",user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
const r = (await pool.request().query(`SELECT c.name AS 列名, d.definition AS 默认值 FROM sys.columns c
 LEFT JOIN sys.default_constraints d ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
 WHERE c.object_id = OBJECT_ID('dbo.kucun') AND (c.is_nullable = 0 OR c.name IN (N'金蝶数量',N'差异数量',N'金蝶同步时间'))`)).recordset;
for (const x of r) console.log(`${x.列名} | default=${x.默认值}`);
await pool.close();
