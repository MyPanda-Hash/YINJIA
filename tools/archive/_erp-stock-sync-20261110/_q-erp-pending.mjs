import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
const pool = await mssql.connect({server:base.server,port:base.port,database:"HSDZ_MES",user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
const q = async (s) => (await pool.request().query(s)).recordset;
const docs = [
  ["PURCHASE_IN","bd_purchase_in"],["SALE_OUT","bd_sale_out"],["MATERIAL_OUT","bd_material_out"],
  ["FINISH_IN","bd_finish_in"],["OTHER_IN","bd_other_in"],["OTHER_OUT","bd_other_out"],
  ["TRANSFER","bd_transfer"],["STOCKTAKE","bd_stocktake"],
];
console.log("面板 | 表 | 已审核 | 已审核且未转ERP | 已审核且已转ERP");
for (const [code, tbl] of docs) {
  const hasErp = (await q(`SELECT COUNT(*) AS n FROM sys.columns WHERE object_id=OBJECT_ID('dbo.${tbl}') AND name=N'是否已转ERP'`))[0].n > 0;
  const sql = `SELECT
      SUM(CASE WHEN s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y' THEN 1 ELSE 0 END) AS 已审核,
      ${hasErp ? `SUM(CASE WHEN s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(h.是否已转ERP,N'否')<>N'是' THEN 1 ELSE 0 END) AS 未转,
                  SUM(CASE WHEN s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y' AND h.是否已转ERP=N'是' THEN 1 ELSE 0 END) AS 已转` : `NULL AS 未转, NULL AS 已转`}
    FROM dbo.${tbl} h LEFT JOIN dbo.yj_doc_status s ON s.panel_code='${code}' AND s.doc_no=h.单据编号`;
  const r = (await q(sql))[0];
  console.log(`${code} | ${tbl} | ${r.已审核} | ${hasErp ? r.未转 : "无ERP列"} | ${hasErp ? r.已转 : "无ERP列"}`);
}
await pool.close();
