/**
 * _q-srv-vs-local-20261017.mjs — 服务器库快照 vs 本地库 的分类对比(只读)。
 *
 * 背景:用户给了 `db\HSDZ_MES-manual-20261015-231541.bak`(生产服务器 ECS-38508784 的
 * **完整备份**,2026-10-15 23:15 打出),要"看服务器库与本地库表内容有什么区别、把服务器的改动同步到本地"。
 * 还原成临时库 `HSDZ_MES_SRV1015` 后,本探针把差异**分类**输出 —— 因为裸列表会把
 * 「真缺一列」和「同名但可空/长度不同」混在一起(580 项里大半是后者),无法据此决定同步方向。
 *
 * 分类:
 *   A 表        : 只在参考(服务器) / 只在目标(本地)
 *   B 列        : 缺列 / 多列 / **同名不同属性**(分别标 类型·长度·精度·可空·自增·默认值)
 *   C 视图      : 只在参考 / 只在目标 / 同名但定义不同(比定义文本的 sha1)
 *   D 元数据    : yj_panel / yj_field / yj_translation / yj_button / yj_role_panel 的行数与缺失键
 *   E 数据      : 每张表的行数(sys.dm_db_partition_stats,不扫描数据),标出参考行数更多/更少
 *
 * 只读:全部 SELECT。用法(仓库根,需先还原 HSDZ_MES_SRV1015):
 *   node tools/archive/_q-srv-vs-local-20261017.mjs
 * 输出:同目录 _q-srv-vs-local-20261017.out
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const req = createRequire(join(ROOT, 'deploy', 'package.json'));
const mssql = req('mssql');

const REF = 'HSDZ_MES_SRV1015';   // 参考 = 服务器快照
const TGT = 'HSDZ_MES';           // 目标 = 本地库

// ⚠ 必须用 new mssql.ConnectionPool —— `mssql.connect(cfg)` 走的是**全局单例池**,
//   连着 connect 两个库时第二次会拿到第一个池 ⇒ 两库"完全一致"的假象(2026-10-17 实测踩到)。
const conn = (db) => new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433, database: db,
  user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  pool: { max: 4 }, requestTimeout: 300000,
});

const q = async (pool, sql) => (await pool.request().query(sql)).recordset;

/** 表 → 列 → 属性签名 */
async function columnMap(pool) {
  const rows = await q(pool, `
    SELECT s.name AS sch, t.name AS tbl, c.name AS col, ty.name AS typ,
           c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity,
           ISNULL(dc.definition, '') AS def
      FROM sys.columns c
      JOIN sys.tables t ON t.object_id = c.object_id
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id`);
  const m = new Map();
  for (const r of rows) m.set(`${r.sch}.${r.tbl}.${r.col}`, r);
  return m;
}
const attrSig = (r) => `${r.typ}|${r.max_length}|${r.precision}|${r.scale}|${r.is_nullable}|${r.is_identity}|${r.def}`;
const attrDiff = (a, b) => {
  const d = [];
  if (a.typ !== b.typ) d.push(`类型 ${a.typ}→${b.typ}`);
  if (a.max_length !== b.max_length) d.push(`长度 ${a.max_length}→${b.max_length}`);
  if (a.precision !== b.precision || a.scale !== b.scale) d.push(`精度 ${a.precision},${a.scale}→${b.precision},${b.scale}`);
  if (a.is_nullable !== b.is_nullable) d.push(`可空 ${a.is_nullable}→${b.is_nullable}`);
  if (a.is_identity !== b.is_identity) d.push(`自增 ${a.is_identity}→${b.is_identity}`);
  if (a.def !== b.def) d.push(`默认值(${a.def || '无'} → ${b.def || '无'})`);
  return d.join('; ');
};

async function tableRows(pool) {
  const rows = await q(pool, `
    SELECT s.name AS sch, t.name AS tbl, SUM(p.rows) AS n
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
     GROUP BY s.name, t.name`);
  const m = new Map();
  for (const r of rows) m.set(`${r.sch}.${r.tbl}`, Number(r.n));
  return m;
}

const out = [];
const say = (s = '') => out.push(s);

const refPool = await conn(REF).connect();
const tgtPool = await conn(TGT).connect();
say(`# 服务器快照(${REF}) vs 本地(${TGT})  生成于 ${new Date().toISOString()}`);
say(`# 参考 = 服务器(2026-10-15 23:15 的完整备份还原);目标 = 本地库`);
say('');

// ── A. 表 ──
const refT = new Set((await q(refPool, `SELECT CONCAT(s.name,'.',t.name) AS k FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id`)).map((r) => r.k));
const tgtT = new Set((await q(tgtPool, `SELECT CONCAT(s.name,'.',t.name) AS k FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id`)).map((r) => r.k));
const onlyRefT = [...refT].filter((k) => !tgtT.has(k)).sort();
const onlyTgtT = [...tgtT].filter((k) => !refT.has(k)).sort();
say(`=== A 表 ===  参考 ${refT.size} / 目标 ${tgtT.size}  |  只在服务器 ${onlyRefT.length}  只在本地 ${onlyTgtT.length}`);
for (const k of onlyRefT) say(`  只在服务器: ${k}`);
for (const k of onlyTgtT) say(`  只在本地  : ${k}`);
say('');

// ── B. 列 ──
const refC = await columnMap(refPool);
const tgtC = await columnMap(tgtPool);
const missCol = [], extraCol = [], attrCol = [];
for (const [k, a] of refC) {
  const b = tgtC.get(k);
  if (!b) { missCol.push(k); continue; }
  const d = attrDiff(a, b);
  if (d) attrCol.push(`${k}  [${d}]`);
}
for (const k of tgtC.keys()) if (!refC.has(k)) extraCol.push(k);
const groupByTable = (arr) => {
  const m = new Map();
  for (const k of arr) { const t = k.split('.').slice(0, 2).join('.'); if (!m.has(t)) m.set(t, []); m.get(t).push(k.split('.')[2] || ''); }
  return [...m].sort((x, y) => y[1].length - x[1].length);
};
say(`=== B 列 ===  参考 ${refC.size} / 目标 ${tgtC.size}  |  缺列 ${missCol.length}  多列 ${extraCol.length}  同名不同属性 ${attrCol.length}`);
say(`  ── 缺列(服务器有、本地没有),按表聚合:`);
for (const [t, cols] of groupByTable(missCol)) say(`     ${t}  (${cols.length}): ${cols.join(' ')}`);
say(`  ── 多列(本地有、服务器没有),按表聚合:`);
for (const [t, cols] of groupByTable(extraCol)) say(`     ${t}  (${cols.length}): ${cols.join(' ')}`);
say(`  ── 同名不同属性(前 60 条):`);
for (const s of attrCol.slice(0, 60)) say(`     ${s}`);
if (attrCol.length > 60) say(`     …(还有 ${attrCol.length - 60} 条)`);
say('');

// ── C. 视图 ──
const views = async (pool) => {
  const rows = await q(pool, `SELECT CONCAT(s.name,'.',v.name) AS k, HASHBYTES('SHA1', m.definition) AS h
                                FROM sys.views v JOIN sys.schemas s ON s.schema_id=v.schema_id
                                JOIN sys.sql_modules m ON m.object_id=v.object_id`);
  const m = new Map();
  for (const r of rows) m.set(r.k, Buffer.from(r.h).toString('hex'));
  return m;
};
const refV = await views(refPool), tgtV = await views(tgtPool);
const onlyRefV = [...refV.keys()].filter((k) => !tgtV.has(k)).sort();
const onlyTgtV = [...tgtV.keys()].filter((k) => !refV.has(k)).sort();
const diffV = [...refV.keys()].filter((k) => tgtV.has(k) && refV.get(k) !== tgtV.get(k)).sort();
say(`=== C 视图 ===  参考 ${refV.size} / 目标 ${tgtV.size}  |  只在服务器 ${onlyRefV.length}  只在本地 ${onlyTgtV.length}  同名定义不同 ${diffV.length}`);
say(`  只在服务器: ${onlyRefV.join(' ') || '(无)'}`);
say(`  只在本地  : ${onlyTgtV.join(' ') || '(无)'}`);
say(`  定义不同  : ${diffV.join(' ') || '(无)'}`);
say('');

// ── D. 元数据 ──
say('=== D 元数据表 ===');
for (const [tbl, keyCols] of [
  ['yj_panel', ['panel_code']],
  ['yj_field', ['panel_code', 'col_name', 'place']],
  ['yj_translation', ['scope', 'ref_key', 'locale']],
  ['yj_button', ['panel_code', 'button_name']],
  ['yj_role_panel', ['role_id', 'panel_code']],
  ['yj_doc_status', ['panel_code', 'form_no']],
]) {
  const cnt = async (pool) => {
    try { return (await q(pool, `SELECT COUNT(*) AS n FROM ${tbl}`))[0].n; } catch (e) { return `ERR:${e.message.split('\n')[0]}`; }
  };
  const a = await cnt(refPool), b = await cnt(tgtPool);
  say(`  ${tbl.padEnd(16)} 服务器 ${String(a).padStart(6)} / 本地 ${String(b).padStart(6)}`);
  const colExpr = (c) => `ISNULL(RTRIM(CAST([${c}] AS nvarchar(200))),'')`;
  const key = keyCols.length === 1
    ? colExpr(keyCols[0])
    : `CONCAT(${keyCols.map(colExpr).join(`, '|', `)})`;
  try {
    const kRef = new Set((await q(refPool, `SELECT ${key} AS k FROM ${tbl}`)).map((r) => r.k));
    const kTgt = new Set((await q(tgtPool, `SELECT ${key} AS k FROM ${tbl}`)).map((r) => r.k));
    const onlyA = [...kRef].filter((k) => !kTgt.has(k));
    const onlyB = [...kTgt].filter((k) => !kRef.has(k));
    say(`     键:只在服务器 ${onlyA.length}  只在本地 ${onlyB.length}`);
    for (const k of onlyA.slice(0, 25)) say(`        只在服务器: ${k}`);
    if (onlyA.length > 25) say(`        …(还有 ${onlyA.length - 25} 条)`);
    for (const k of onlyB.slice(0, 15)) say(`        只在本地  : ${k}`);
    if (onlyB.length > 15) say(`        …(还有 ${onlyB.length - 15} 条)`);
  } catch (e) { say(`     键比对失败: ${e.message.split('\n')[0]}`); }
}
say('');

// ── E. 数据行数 ──
const refR = await tableRows(refPool), tgtR = await tableRows(tgtPool);
const dataDiff = [];
for (const [t, n] of refR) {
  const m = tgtR.get(t);
  if (m === undefined) continue;
  if (m !== n) dataDiff.push([t, n, m]);
}
dataDiff.sort((a, b) => Math.abs(b[1] - b[2]) - Math.abs(a[1] - a[2]));
const moreOnSrv = dataDiff.filter(([, a, b]) => a > b);
const moreOnLoc = dataDiff.filter(([, a, b]) => a < b);
say(`=== E 数据行数 ===  行数不同的表 ${dataDiff.length}(服务器更多 ${moreOnSrv.length} / 本地更多 ${moreOnLoc.length})`);
say(`  ── 服务器更多(前 40;服务器行数 / 本地行数):`);
for (const [t, a, b] of moreOnSrv.slice(0, 40)) say(`     ${t.padEnd(38)} ${String(a).padStart(8)} / ${String(b).padStart(8)}`);
say(`  ── 本地更多(前 25):`);
for (const [t, a, b] of moreOnLoc.slice(0, 25)) say(`     ${t.padEnd(38)} ${String(a).padStart(8)} / ${String(b).padStart(8)}`);

writeFileSync(join(ROOT, 'tools', 'archive', '_q-srv-vs-local-20261017.out'), out.join('\n') + '\n', 'utf8');
console.log(out.join('\n'));
await refPool.close(); await tgtPool.close();
