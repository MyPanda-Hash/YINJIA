import { readFileSync } from "node:fs";
import sql from "../../../deploy/node_modules/mssql/index.js";
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url), "utf8")).database;
const pool = await sql.connect({ server: cfg.server, port: cfg.port, database: cfg.database, user: cfg.user, password: cfg.password, options: { encrypt: false, trustServerCertificate: true } });
const r = await pool.request().query(`
SELECT t.name AS tbl, i.name AS idx, i.type_desc, i.is_unique, i.is_primary_key,
       STUFF((SELECT ',' + c2.name FROM sys.index_columns ic2 JOIN sys.columns c2 ON c2.object_id=ic2.object_id AND c2.column_id=ic2.column_id
              WHERE ic2.object_id=i.object_id AND ic2.index_id=i.index_id ORDER BY ic2.key_ordinal FOR XML PATH('')),1,1,'') AS cols
FROM sys.indexes i JOIN sys.tables t ON t.object_id=i.object_id
WHERE t.name IN ('bd_sale_out','bl_sale_out','bd_material_out','bl_material_out') AND i.type>0
ORDER BY t.name, i.index_id`);
console.log(r.recordset.map(x => `${x.tbl} | ${x.idx} | ${x.type_desc} | uniq=${x.is_unique} pk=${x.is_primary_key} | ${x.cols}`).join('\n'));
await pool.close();
