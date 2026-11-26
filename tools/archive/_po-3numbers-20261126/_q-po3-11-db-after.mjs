import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const HERE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "deploy");
const cfg = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8").replace(/^\uFEFF/, ""));
const mssql = createRequire(join(HERE, "_probe.cjs"))("mssql");
const pool = await mssql.connect({ ...cfg.database, options: { trustServerCertificate: true } });
const r = await pool.request().query(`SELECT 单据编号, 行号, 物料编码, 数量, 行已执行数量, 行未执行数量, 行入库状态
  FROM bl_pu_order WHERE 单据编号 IN (N'YJ-20261111-06', N'YJ-20261119-04') ORDER BY 单据编号, 行号`);
for (const x of r.recordset) console.log(`${x.单据编号} 行${x.行号} ${x.物料编码} 数=${x.数量} 已入=${x.行已执行数量} 未入=${x.行未执行数量} ${x.行入库状态}`);
await pool.close();
