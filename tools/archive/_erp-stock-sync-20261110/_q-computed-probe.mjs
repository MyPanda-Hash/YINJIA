import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
const pool = await mssql.connect({server:base.server,port:base.port,database:"HSDZ_MES_TEST",user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
const q = async (s) => (await pool.request().query(s)).recordset;
try {
  await q(`ALTER TABLE dbo.kucun ADD [__probe_diff] AS (CAST([金蝶数量] AS decimal(18,4)) - CAST(ISNULL([yl],0) AS decimal(18,4)))`);
  console.log("OK: float 列参与计算列可用");
  await q(`ALTER TABLE dbo.kucun DROP COLUMN [__probe_diff]`);
  console.log("OK: 已清理探针列");
} catch (e) { console.log("FAIL:", e.message); }
await pool.close();
