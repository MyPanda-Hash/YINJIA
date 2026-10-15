/**
 * _q-ledger-diff-20261017.mjs — 两个账套的迁移登记(yj_schema_log)差集。
 *
 * 背景:AGENTS「一切库变更必须两个账套都执行」。实测 HSDZ_MES 缺 yj_doc_annotation 表
 * 与 3 条 yj_field(RD_APPROVAL.附件1 / RD_CHANGE.标题 / RD_PROD_INFO.立项文档编号),
 * 而 TEST 有 —— 因为 DbSync **遇第一个失败脚本即中止**,两账套卡在不同位置,
 * 正式因此在 migrate-stock-report-dup-fields-20261015.sql 之后全部没跑。
 *
 * 只读。用法:node tools/archive/_q-ledger-diff-20261017.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const mssql = createRequire(join(ROOT, 'deploy', 'package.json'))('mssql');

const read = async (db) => {
  const pool = await new mssql.ConnectionPool({
    server: cfg.database.server, port: cfg.database.port || 1433, database: db,
    user: cfg.database.user, password: cfg.database.password,
    options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  }).connect();
  try {
    const r = await pool.request().query('SELECT script_name, content_hash, applied_at FROM yj_schema_log');
    return new Map(r.recordset.map((x) => [String(x.script_name).trim(), { hash: String(x.content_hash).trim(), at: x.applied_at }]));
  } finally { await pool.close(); }
};

const [prod, test] = await Promise.all([read('HSDZ_MES'), read('HSDZ_MES_TEST')]);
console.log(`登记条数:正式 ${prod.size} / 测试 ${test.size}`);

const onlyTest = [...test.keys()].filter((k) => !prod.has(k));
const onlyProd = [...prod.keys()].filter((k) => !test.has(k));
const hashDiff = [...test.keys()].filter((k) => prod.has(k) && prod.get(k).hash !== test.get(k).hash);

console.log(`\n=== 测试有、正式没有(${onlyTest.length} 条)===`);
for (const k of onlyTest.sort()) console.log(`  ${k}   [TEST ${new Date(test.get(k).at).toISOString().slice(0, 10)}]`);
console.log(`\n=== 正式有、测试没有(${onlyProd.length} 条)===`);
for (const k of onlyProd.sort().slice(0, 40)) console.log(`  ${k}`);
console.log(`\n=== 同名但内容哈希不同(${hashDiff.length} 条:两侧跑过的版本不一样)===`);
for (const k of hashDiff.sort().slice(0, 40)) console.log(`  ${k}`);
