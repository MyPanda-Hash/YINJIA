import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
const pool = await mssql.connect({server:base.server,port:base.port,database:"HSDZ_MES_TEST",user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
const q = async (s) => (await pool.request().query(s)).recordset;
// 造 3 种情形:①仅 MES 有(清零) ②数量偏差(覆盖) ③MES 缺行(新增)
await q(`DELETE FROM dbo.kucun WHERE wzdm=N'TEST-MAT-SYNC'`);
await q(`INSERT INTO dbo.kucun (wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, asp_user1, asp_time1, asp_cancel)
        VALUES (N'TEST-MAT-SYNC', N'CK01', NULL, GETDATE(), 50, 0, 50, N'probe', GETDATE(), N'N')`);
const hit = await q(`SELECT TOP 1 id, wzdm, ckdm, lot_no, yl FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND wzdm<>N'TEST-MAT-SYNC' AND ISNULL(yl,0)>0 ORDER BY id`);
await q(`UPDATE dbo.kucun SET yl = yl + 10 WHERE id = ${hit[0].id}`);
console.log(`② 覆盖样例:${hit[0].wzdm}|${hit[0].ckdm}|${hit[0].lot_no}|yl ${hit[0].yl} → ${Number(hit[0].yl)+10}`);
const del = await q(`SELECT TOP 1 id, wzdm, ckdm, lot_no, yl FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND wzdm<>N'TEST-MAT-SYNC' AND wzdm<>N'${hit[0].wzdm}' ORDER BY id DESC`);
await q(`DELETE FROM dbo.kucun WHERE id = ${del[0].id}`);
console.log(`③ 新增样例(已删 MES 行):${del[0].wzdm}|${del[0].ckdm}|${del[0].lot_no}|yl ${del[0].yl}`);
await pool.close();
