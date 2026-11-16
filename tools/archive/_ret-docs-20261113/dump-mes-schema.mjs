// 只读:把 MES(正式库)里「销售出库 / 材料出库」两套单据的表结构、面板字段、面板行、角色行、视图定义
// 全量 dump 成 JSON,供 tools/archive/_gen-return-docs-20261113.mjs 生成两张新单据的迁移脚本。
// 用法: node tools/archive/_ret-docs-20261113/dump-mes-schema.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import sql from '../../../deploy/node_modules/mssql/index.js';

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).database;
const pool = await sql.connect({
  server: cfg.server, port: cfg.port, database: cfg.database,
  user: cfg.user, password: cfg.password,
  options: { encrypt: cfg.encrypt ?? false, trustServerCertificate: true },
});

const q = async (text, params) => (await pool.request().query(text)).recordset;

const TABLES = ['bd_sale_out', 'bl_sale_out', 'bd_material_out', 'bl_material_out'];
const PANELS = ['SALE_OUT', 'SALE_OUT_DETAIL', 'SALE_OUT_STATS', 'MATERIAL_OUT', 'MATERIAL_OUT_DETAIL', 'MATERIAL_OUT_STATS'];
const VIEWS = ['v_sale_out_detail', 'v_sale_out_stats', 'v_material_out_detail', 'v_material_out_stats'];

const out = { dumpedAt: new Date().toISOString(), database: cfg.database, tables: {}, panels: {}, views: {} };

for (const t of TABLES) {
  out.tables[t] = await q(`
    SELECT c.column_id, c.name, ty.name AS type_name, c.max_length, c.precision, c.scale,
           c.is_nullable, c.is_identity, c.is_computed,
           CAST(ep.value AS nvarchar(4000)) AS comment
    FROM sys.columns c
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    LEFT JOIN sys.extended_properties ep
           ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
    WHERE c.object_id = OBJECT_ID(N'dbo.${t}')
    ORDER BY c.column_id`);
}

for (const p of PANELS) {
  out.panels[p] = {
    panel: (await q(`SELECT * FROM yj_panel WHERE panel_code = '${p}'`))[0],
    fields: await q(`SELECT * FROM yj_field WHERE panel_code = '${p}' ORDER BY seq, id`),
    roles: await q(`SELECT * FROM yj_role_panel WHERE panel_code = '${p}'`),
  };
}

for (const v of VIEWS) {
  const r = await q(`SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.${v}')) AS def`);
  out.views[v] = r[0]?.def ?? null;
}

// 顺带记下 yj_panel / yj_field / yj_role_panel 的列结构(生成器按此拼 INSERT)
out.meta = {
  yj_panel_cols: (await q(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('yj_panel') ORDER BY column_id`)).map((x) => x.name),
  yj_field_cols: (await q(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('yj_field') ORDER BY column_id`)).map((x) => x.name),
  yj_role_panel_cols: (await q(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('yj_role_panel') ORDER BY column_id`)).map((x) => x.name),
};

writeFileSync(new URL('./mes-schema-dump.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log('tables:', Object.entries(out.tables).map(([k, v]) => `${k}=${v.length}`).join(' '));
console.log('fields:', Object.entries(out.panels).map(([k, v]) => `${k}=${v.fields.length}`).join(' '));
console.log('views:', Object.entries(out.views).map(([k, v]) => `${k}=${v ? v.length + 'ch' : 'NULL'}`).join(' '));
await pool.close();
