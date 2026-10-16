/**
 * _q-oldlabel-residue-20261017.mjs — 旧标签「合格数量（入库）」残留 + 新标签译名语言覆盖(两账套,只读)
 * 用法(仓库根目录):node tools/archive/_q-oldlabel-residue-20261017.mjs
 * 输出:tools/archive/_q-oldlabel-residue-20261017.out(UTF-8)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const req = createRequire(join(ROOT, 'deploy', 'package.json'));
const mssql = req('mssql');

const LABELS = ['合格数量', '检验结果', '检验时间', '抽检总量', '检验类型', '产线常规功能性结果', '结果判断'];

const C = [
  ['OLD 旧标签全库残留计数(yj_field/yj_translation/yj_report_template/yj_panel.config/yj_field.alias)',
   `SELECT
      (SELECT COUNT(*) FROM yj_field WHERE col_name LIKE N'%合格数量（入库）%' OR label LIKE N'%合格数量（入库）%'
        OR ISNULL(alias,N'') LIKE N'%合格数量（入库）%' OR ISNULL(label_en,N'') LIKE N'%合格数量（入库）%') AS yj_field_hits,
      (SELECT COUNT(*) FROM yj_translation WHERE ref_key LIKE N'%合格数量（入库）%' OR text LIKE N'%合格数量（入库）%') AS yj_translation_hits,
      (SELECT COUNT(*) FROM yj_report_template WHERE jrxml_text LIKE N'%合格数量（入库）%') AS report_hits,
      (SELECT COUNT(*) FROM yj_panel WHERE CONVERT(nvarchar(max),config) LIKE N'%合格数量（入库）%') AS panel_config_hits,
      (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.qc_asm_insp_head') AND name LIKE N'%合格数量（入库）%') AS phys_col_hits`],
  ['OLD 旧译名任意 scope 残留(应 0)', `SELECT scope, ref_key, locale FROM yj_translation WHERE ref_key LIKE N'%合格数量（入库）%'`],
  ['NEW 新标签译名逐 key × locale', `SELECT ref_key, locale, text FROM yj_translation
      WHERE scope=N'field' AND ref_key IN (${LABELS.map((l) => `N'${l}'`).join(',')}) ORDER BY ref_key, locale`],
  ['NEW 新标签译名语言数汇总', `SELECT ref_key, COUNT(*) AS locales,
      SUM(CASE WHEN locale='en' THEN 1 ELSE 0 END) AS has_en FROM yj_translation
      WHERE scope=N'field' AND ref_key IN (${LABELS.map((l) => `N'${l}'`).join(',')}) GROUP BY ref_key ORDER BY ref_key`],
];

async function runDb(dbName) {
  const pool = new mssql.ConnectionPool({
    server: cfg.database.server, port: cfg.database.port || 1433, database: dbName,
    user: cfg.database.user, password: cfg.database.password,
    options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  });
  await pool.connect();
  const out = [`########## ${dbName} ##########`];
  for (const [title, sql] of C) {
    out.push(`\n--- ${title} ---`);
    try {
      const r = await pool.request().query(sql);
      if (!r.recordset.length) out.push('(0 行)');
      for (const row of r.recordset) out.push(JSON.stringify(row));
    } catch (e) { out.push(`[查询失败] ${e.message}`); }
  }
  await pool.close();
  return out.join('\n');
}

const chunks = [];
for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) chunks.push(await runDb(db));
writeFileSync(join(ROOT, 'tools', 'archive', '_q-oldlabel-residue-20261017.out'), chunks.join('\n\n'), 'utf8');
console.log('written');
