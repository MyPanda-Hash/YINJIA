import mssql from "mssql";
import { readFileSync } from "node:fs";
const base = JSON.parse(readFileSync("D:/YINJIA-main/deploy/config.json","utf8")).database;
for (const db of ["HSDZ_MES","HSDZ_MES_TEST"]) {
  const pool = await mssql.connect({server:base.server,port:base.port,database:db,user:base.user,password:base.password,options:{encrypt:false,trustServerCertificate:true}});
  const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
  const f = await q(`SELECT id,label,col_name,visible,hidden,seq,width FROM yj_field WHERE panel_code=N'PU_ORDER' AND col_name IN (N'行已执行数量',N'行未执行数量') ORDER BY seq`);
  const v = await q(`SELECT role_code,col_name,shown,seq FROM yj_field_view WHERE panel_code=N'PU_ORDER' AND col_name IN (N'行已执行数量',N'行未执行数量') ORDER BY col_name`);
  const t = await q(`SELECT ref_key,locale,text,source FROM yj_translation WHERE ref_key IN (N'金蝶已入库数量',N'金蝶未入库数量') ORDER BY ref_key`);
  console.log(`\n=== ${db} ===`);
  console.log("字段:", JSON.stringify(f));
  console.log("角色视图:", JSON.stringify(v));
  console.log("译名:", JSON.stringify(t));
  await pool.close();
}
