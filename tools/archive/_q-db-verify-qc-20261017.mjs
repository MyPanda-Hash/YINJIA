/**
 * _q-db-verify-qc-20261017.mjs — 未提交迁移的库侧只读取证(两账套),2026-10-17
 *
 * 为什么不用 SqlRunner:JDK 23 控制台 stdout 编码把中文吐成乱码,取证要**原样字节**。
 * 这里走 db 驱动 + fs.writeFileSync(UTF-8),输出文件 archive/_q-db-verify-qc-20261017.out。
 *
 * 用法(仓库根目录):node tools/archive/_q-db-verify-qc-20261017.mjs
 * 输出:每条查询一段「[n] 标题」+ JSON 行,两个账套各一份。只读,无 DDL/DML。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const req = createRequire(join(ROOT, 'deploy', 'package.json'));
const mssql = req('mssql');

const NEW_MIGRATIONS = [
  'migrate-asm-insp-fixed-groups-20261016.sql',
  'migrate-asm-insp-fixed-items-20261016.sql',
  'migrate-asm-insp-passqty-in-20261017.sql',
  'migrate-asm-insp-passqty-rename-20261017.sql',
  'migrate-asm-insp-report-fields-20261016.sql',
  'migrate-asm-insp-type-rename-20261017.sql',
  'migrate-asm-insp-verdict-rename-20261016.sql',
  'migrate-qc-proc-insp-audit-trail-20261017.sql',
  'migrate-qc-proc-insp-func-result-20261017.sql',
  'migrate-qc-proc-insp-report-vertical-20261017.sql',
];

const Q = [
  ['[1] yj_schema_log 10 条新迁移', `
    SELECT script_name, content_hash, CONVERT(varchar(19), applied_at, 120) AS applied_at
    FROM dbo.yj_schema_log WHERE script_name IN (${NEW_MIGRATIONS.map((s) => `N'${s}'`).join(',')})
    ORDER BY script_name`],
  ['[2] yj_field QC_ASM_INSP 表头字段', `
    SELECT id, seq, col_name, label, data_type, place, visible, hidden, editable, required
    FROM yj_field WHERE panel_code = N'QC_ASM_INSP' AND place LIKE N'%header%' ORDER BY seq, id`],
  ['[3] yj_field 全库旧标签「合格数量（入库）」残留', `
    SELECT id, panel_code, col_name, label, place, seq FROM yj_field
    WHERE col_name LIKE N'%合格数量（入库）%' OR label LIKE N'%合格数量（入库）%' ORDER BY panel_code, seq`],
  ['[4] yj_field 全库「合格数量」登记', `
    SELECT id, panel_code, col_name, label, place, seq, required, visible, hidden FROM yj_field
    WHERE col_name = N'合格数量' OR label = N'合格数量' ORDER BY panel_code, seq`],
  ['[5] yj_translation 新旧 key', `
    SELECT scope, ref_key, locale, text, source FROM yj_translation
    WHERE ref_key IN (N'合格数量', N'合格数量（入库）') ORDER BY ref_key, locale`],
  ['[6] yj_panel.config QC_ASM_INSP', `
    SELECT panel_code, config FROM yj_panel WHERE panel_code = N'QC_ASM_INSP'`],
  ['[7] qc_asm_insp_head 含「合格」列', `
    SELECT c.column_id, c.name AS col_name, t.name AS type_name, c.precision, c.scale, c.is_nullable
    FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.qc_asm_insp_head') AND c.name LIKE N'%合格%' ORDER BY c.column_id`],
];

async function runDb(dbName) {
  const pool = new mssql.ConnectionPool({
    server: cfg.database.server, port: cfg.database.port || 1433, database: dbName,
    user: cfg.database.user, password: cfg.database.password,
    options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  });
  await pool.connect();
  const out = [`########## ${dbName} ##########`];
  for (const [title, sql] of Q) {
    out.push(`\n--- ${title} ---`);
    try {
      const r = await pool.request().query(sql);
      if (!r.recordset.length) out.push('(0 行)');
      for (const row of r.recordset) out.push(JSON.stringify(row));
    } catch (e) {
      out.push(`[查询失败] ${e.message}`);
    }
  }
  await pool.close();
  return out.join('\n');
}

const chunks = [];
for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) chunks.push(await runDb(db));

// yj_panel.config 的 fixedItems 声明是不是**合法 JSON**(两账套各验一次)
for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) {
  const pool = new mssql.ConnectionPool({
    server: cfg.database.server, port: cfg.database.port || 1433, database: db,
    user: cfg.database.user, password: cfg.database.password,
    options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  });
  await pool.connect();
  const r = await pool.query(`SELECT config FROM yj_panel WHERE panel_code = N'QC_ASM_INSP'`);
  await pool.close();
  const raw = r.recordset[0]?.config ?? '(无行)';
  chunks.push(`\n--- [8] config JSON 解析 ${db} ---`);
  try {
    const j = JSON.parse(raw);
    chunks.push(`valid JSON = YES; top keys = [${Object.keys(j).join(',')}]; `
      + `fixedItems groups = [${j.fixedItems.map((g) => g.group).join(',')}]; `
      + `group0.items = ${JSON.stringify(j.fixedItems[0].items)}; group1.label = ${j.fixedItems[1].label}`);
  } catch (e) {
    chunks.push(`valid JSON = NO -> ${e.message}`);
  }
}

const text = chunks.join('\n\n');
writeFileSync(join(ROOT, 'tools', 'archive', '_q-db-verify-qc-20261017.out'), text, 'utf8');
console.log(text);
