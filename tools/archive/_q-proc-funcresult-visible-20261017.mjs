/**
 * _q-proc-funcresult-visible-20261017.mjs — 「产线常规功能性结果」列在两账套的实际可见性取证(只读)。
 *
 * 为什么要有它:审查发现 migrate-qc-proc-insp-func-result-20261017.sql 的 yj_field INSERT 写
 * visible = 0(而镜像来源 migrate-asm-insp-func-test-20261016.sql 对**同一个标签**写 visible = 1),
 * ELSE 分支也只收敛 hidden/editable、不动 visible ⇒ 该列在列表页/列自定义里默认不显示
 * (判据 PanelxList.vue: hidden !== true && visible !== false),与台账「可编辑可见」的说法不符。
 *
 * 本探针只读:查两账套 QC_PROC_INSP / QC_ASM_INSP 的同名列 + 全局该标签的登记情况。
 * 用法(仓库根目录):node tools/archive/_q-proc-funcresult-visible-20261017.mjs
 * 输出:同目录 _q-proc-funcresult-visible-20261017.out
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const req = createRequire(join(ROOT, 'deploy', 'package.json'));
const mssql = req('mssql');

const LABEL = '产线常规功能性结果';
const chunks = [];

async function run(dbName) {
  const pool = await mssql.connect({
    server: cfg.database.server,
    port: cfg.database.port || 1433,
    database: dbName,
    user: cfg.database.user,
    password: cfg.database.password,
    options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  });
  try {
    const r = await pool.request()
      .input('L', mssql.NVarChar, LABEL)
      .query(`SELECT panel_code, col_name, label, data_type, place, seq, width,
                     editable, required, hidden, visible, id
                FROM yj_field
               WHERE label = @L AND panel_code IN (N'QC_PROC_INSP', N'QC_ASM_INSP')
               ORDER BY panel_code`);
    chunks.push(`\n=== ${dbName} ===`);
    for (const row of r.recordset) chunks.push(JSON.stringify(row));
    if (!r.recordset.length) chunks.push('(no rows)');
  } finally {
    await pool.close();
  }
}

for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) {
  try {
    await run(db);
  } catch (e) {
    chunks.push(`\n=== ${db} ===\nERROR: ${e.message}`);
  }
}

const out = chunks.join('\n') + '\n';
writeFileSync(join(ROOT, 'tools', 'archive', '_q-proc-funcresult-visible-20261017.out'), out, 'utf8');
console.log(out);
