import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
const pool = await mssql.connect({server:base.server,port:base.port,database:"HSDZ_MES_TEST",user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
const q = async (s) => (await pool.request().query(s)).recordset;
console.log("— 测试库草稿采购入库(前3) —");
for (const r of await q(`SELECT TOP 3 h.单据编号, h.单据日期, ISNULL(s.shr,N'(未审)') AS shr, ISNULL(s.saved,N'-') AS saved
  FROM dbo.bd_purchase_in h LEFT JOIN dbo.yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  WHERE h.asp_cancel<>'Y' AND s.shr IS NULL AND ISNULL(s.canceled,'N')<>'Y' ORDER BY h.单据编号 DESC`)) console.log(JSON.stringify(r));
console.log("— 测试库草稿调拨单(前3) —");
for (const r of await q(`SELECT TOP 3 h.单据编号, h.单据日期 FROM dbo.bd_transfer h LEFT JOIN dbo.yj_doc_status s ON s.panel_code='TRANSFER' AND s.doc_no=h.单据编号
  WHERE h.asp_cancel<>'Y' AND s.shr IS NULL ORDER BY h.单据编号 DESC`)) console.log(JSON.stringify(r));
await pool.close();
