import { readFileSync, writeFileSync } from "node:fs";
import mssql from "../../../deploy/node_modules/mssql/index.js";
const base = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url),"utf8")).database;
const pool = await mssql.connect({server:base.server,port:base.port,database:"HSDZ_MES",user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true},pool:{max:2,min:0,idleTimeoutMillis:3000}});
const d = (await pool.request().query(`SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.v_stock_balance')) AS d`)).recordset[0].d;
writeFileSync(new URL("./_v-stock-balance-now.sql", import.meta.url), d, "utf8");
console.log(d);
await pool.close();
