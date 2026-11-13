import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
const pool = await mssql.connect({server:base.server,port:base.port,database:"HSDZ_MES_TEST",user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
const q = async (s) => (await pool.request().query(s)).recordset;
console.log("— 本轮清零快照 —");
for (const r of await q(`SELECT 物料编码,仓库编码,批号,金蝶数量,MES原数量,差异数量 FROM dbo.erp_stock_snapshot WHERE 处理方式=N'清零' ORDER BY 差异数量`)) console.log(JSON.stringify(r));
console.log("— 这些键在 kucun 的行 —");
for (const r of await q(`SELECT k.id,k.wzdm,k.ckdm,ISNULL(k.lot_no,'(null)') AS lot,k.yl,k.[金蝶数量],k.[金蝶同步时间] FROM dbo.kucun k
  WHERE EXISTS (SELECT 1 FROM dbo.erp_stock_sync_log l WHERE l.批次号='20261110124633')
    AND (k.wzdm=N'YJ-KG-YM-B01-笼子' OR k.wzdm=N'YJ-KG-YM-B14' OR k.wzdm=N'YJ-GL-006')`)) console.log(JSON.stringify(r));
console.log("— 重复键检查 —");
for (const r of await q(`SELECT COUNT(*) AS 组数 FROM (SELECT 1 FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY wzdm,ckdm,ISNULL(lot_no,'') HAVING COUNT(*)>1) t`)) console.log(JSON.stringify(r));
await pool.close();
