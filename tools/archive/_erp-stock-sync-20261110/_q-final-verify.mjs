import { readFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
const pool = await mssql.connect({server:base.server,port:base.port,database:"HSDZ_MES",user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
const q = async (s) => (await pool.request().query(s)).recordset;
for (const [name, sql] of [
  ["v_stock_kucun(库存明细)", "SELECT COUNT(*) AS n, CAST(SUM(现存量) AS decimal(18,2)) AS s FROM v_stock_kucun"],
  ["v_stock_pick(库存选货)", "SELECT COUNT(*) AS n, CAST(SUM(现存量) AS decimal(18,2)) AS s FROM v_stock_pick"],
  ["v_stock_balance(库存状况表)", "SELECT COUNT(*) AS n, CAST(SUM(现存量) AS decimal(18,2)) AS s FROM v_stock_balance"],
  ["v_stock_ledger(库存台账)", "SELECT COUNT(*) AS n FROM v_stock_ledger"],
]) { try { console.log(name, JSON.stringify((await q(sql))[0])) } catch (e) { console.log(name, "ERR", e.message) } }
console.log("— 出库校验口径抽查(按 物料+仓库 可用合计)—");
for (const r of await q(`SELECT TOP 3 wzdm, ckdm, CAST(SUM(ISNULL(yl,0)) AS decimal(18,2)) AS 可用合计, COUNT(*) AS 批次数
  FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY wzdm, ckdm ORDER BY SUM(ISNULL(yl,0)) DESC`)) console.log(JSON.stringify(r));
await pool.close();
