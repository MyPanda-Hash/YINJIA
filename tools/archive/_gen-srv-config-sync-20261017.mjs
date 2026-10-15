/**
 * _gen-srv-config-sync-20261017.mjs — 生成「服务器端配置改动 → 本地」的迁移脚本(一次性,生成后随任务提交)。
 *
 * 口径(用户 2026-10-17 拍板:只同步服务器端**配置**改动,不动数据):
 *   ① yj_field:服务器上把**备用列登记成自定义标签**的行(col_name LIKE '备用%' AND label NOT LIKE '备用%'),
 *      且该面板在本地仍存在、本地也没有同 label 的行 ⇒ 本地缺的真缺口。
 *      自动排除:面板已下架(QC_MOLD/CUT_INSP、QC_FIN_SPEC)、本地有意改名(标准要求/判定/表区)、
 *      本地有意注销(数量/实测数值)、本地有意删掉的报表日期字段(STOCK_* 开始/结束日期)。
 *   ② yj_translation:服务器独有的译名里,**ref_key 在本地还有引用**的那些
 *      (scope=field 且本地 yj_field 还有该 label;scope=panel 且本地还有该面板码/名)。
 *
 * 用法(仓库根,需先还原 HSDZ_MES_SRV1015):node tools/archive/_gen-srv-config-sync-20261017.mjs
 * 产出:tools/migrate-srv-config-sync-20261017.sql
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const mssql = createRequire(join(ROOT, 'deploy', 'package.json'))('mssql');
const conn = (db) => new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433, database: db,
  user: cfg.database.user, password: cfg.database.password,
  options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  pool: { max: 2 }, requestTimeout: 300000,
});
const q = async (p, s) => (await p.request().query(s)).recordset;

const REF = 'HSDZ_MES_SRV1015';
// 目标库可指定:第一次生成用 HSDZ_MES(当时的本地状态);同步做完后若要**重现同一份脚本**,
// 指向同步前的快照库(HSDZ_MES_PRESYNC)再跑,否则"已经同步过"的判据会把已补的行筛掉。
const TGT = process.argv[2] || 'HSDZ_MES';

const ref = await conn(REF).connect();
const tgt = await conn(TGT).connect();

const FCOLS = ['panel_code', 'col_name', 'label', 'data_type', 'dict_sql', 'ref_panel', 'ref_field',
  'display_field', 'place', 'seq', 'width', 'editable', 'required', 'hidden', 'alias', 'visible',
  'label_en', 'col_group', 'ref_filter', 'tab_key'];

const tgtFields = await q(tgt, `SELECT RTRIM(panel_code) AS panel_code, RTRIM(col_name) AS col_name, label, RTRIM(place) AS place FROM yj_field`);
const tgtPanels = new Set((await q(tgt, `SELECT RTRIM(panel_code) AS p FROM yj_panel`)).map((r) => r.p));
const tgtPanelNames = new Set((await q(tgt, `SELECT RTRIM(panel_code) AS p, RTRIM(ISNULL(panel_name,'')) AS n FROM yj_panel`)).flatMap((r) => [r.p, r.n]));
const tgtLabels = new Set(tgtFields.map((r) => r.label));
/** (panel_code|col_name) → 本地那一行 */ 
const tgtByPanelCol = new Map(tgtFields.map((r) => [`${r.panel_code}|${r.col_name}`, r]));

// ── ① 备用列被登记成自定义标签、本地缺的那些 ──
// 判据必须**幂等且与当前状态无关**(第一版按"本地有没有同 label"筛,补完之后再跑就全被排除了):
//   · 本地同 (panel_code, col_name) 已有行:标签相同 ⇒ 已同步过;标签不同 ⇒ 本地自己改过名 ⇒ 都跳过
//   · 本地没有该 col_name:若本地别处已有同 label ⇒ 是"改名/别处已登记" ⇒ 跳过
//   · 其余 ⇒ 真缺口,纳入
const srvFields = await q(ref, `SELECT ${FCOLS.map((c) => `RTRIM(CAST([${c}] AS nvarchar(1000))) AS [${c}]`).join(', ')} FROM yj_field WHERE col_name LIKE N'备用%' AND label NOT LIKE N'备用%' ORDER BY panel_code, seq, id`);
const picked = [];
const skipped = [];
for (const r of srvFields) {
  if (!tgtPanels.has(r.panel_code)) { skipped.push([r, '面板本地已下架']); continue; }
  const same = tgtByPanelCol.get(`${r.panel_code}|${r.col_name}`);
  if (same) { skipped.push([r, same.label === r.label ? '已经同步过(本地同列同行)' : '本地同列已改成别的标签']); continue; }
  if (tgtLabels.has(r.label)) { skipped.push([r, '本地已有同 label 行(改名/别处已登记)']); continue; }
  picked.push(r);
}

// ── ② 服务器独有的译名(本地还有引用) ──
// ⚠ 关键:判「字段还在不在用」必须算上**本脚本①正要补进去的那 33 个 label** —— 否则
//   `field|检验方法1|en` 这类会被误判成孤儿译名丢掉,而字段补上之后它立刻又变成真缺口
//   (2026-10-17 实测:第一版就漏了 17 条 en,补完字段后立刻重现)。故用 willExist。
const liveLabels = new Set([...tgtLabels, ...picked.map((r) => r.label)]);
const TCOLS = ['scope', 'ref_key', 'locale', 'text', 'source'];
const srvT = await q(ref, `SELECT ${TCOLS.map((c) => `RTRIM(CAST([${c}] AS nvarchar(1000))) AS [${c}]`).join(', ')} FROM yj_translation`);
const tgtTSet = new Set((await q(tgt, `SELECT RTRIM(scope) AS s, ref_key AS k, RTRIM(locale) AS lo FROM yj_translation`)).map((r) => `${r.s}|${r.k}|${r.lo}`));
const pickedT = [];
const skippedT = [];
for (const r of srvT) {
  if (tgtTSet.has(`${r.scope}|${r.ref_key}|${r.locale}`)) continue;
  const live = r.scope === 'field' ? liveLabels.has(r.ref_key) : (r.scope === 'panel' ? tgtPanelNames.has(r.ref_key) : false);
  if (live) pickedT.push(r); else skippedT.push([r, r.scope === 'field' ? '本地已无该 label 的字段行(且本脚本也不新增)' : '本地已无该面板']);
}

const esc = (s) => (s === null || s === undefined || s === '') ? 'NULL' : `N'${String(s).replace(/'/g, "''")}'`;
const escV = (s) => `'${String(s).replace(/'/g, "''")}'`;
const num = (v, d = 0) => (v === null || v === undefined || v === '') ? String(d) : String(Number(v));
const bit = (v) => (String(v) === '1' || String(v).toLowerCase() === 'true' ? '1' : '0');

const L = [];
L.push(`/* migrate-srv-config-sync-20261017.sql — 服务器端「配置改动」反向同步到本地(由生成器产出,勿手改)`);
L.push(` *`);
L.push(` * 来源:生产服务器 ECS-38508784 的手工完整备份 db\\HSDZ_MES-manual-20261015-231541.bak`);
L.push(` *   (2026-10-15 23:15;还原成临时库 HSDZ_MES_SRV1015 后逐项比对出来的差异)。`);
L.push(` * 口径(用户 2026-10-17 拍板):**只同步服务器端的配置改动,不动任何业务数据**。`);
L.push(` *`);
L.push(` * ① yj_field ${picked.length} 行:服务器上把「备用列」登记成了有意义的自定义标签`);
L.push(` *    (col_name LIKE '备用%' 而 label 不是备用名),而本地该面板还在、也没有同 label 的行 ⇒ 本地缺。`);
L.push(` *    分布:${[...new Set(picked.map((r) => r.panel_code))].map((p) => `${p}(${picked.filter((r) => r.panel_code === p).length})`).join(' ')}`);
L.push(` *    自动排除(本地有意为之,不属缺口):`);
const skipReasons = new Map();
for (const [r, why] of skipped) { const k = `${r.panel_code} · ${why}`; skipReasons.set(k, (skipReasons.get(k) || 0) + 1); }
for (const [k, n] of skipReasons) L.push(` *      - ${k} × ${n}`);
L.push(` * ② yj_translation ${pickedT.length} 行:服务器独有的译名里,ref_key 在本地**还有引用**的`);
L.push(` *    (field: 本地仍有该 label 的字段行;panel: 本地仍有该面板)。`);
L.push(` *    分布:${[...new Set(pickedT.map((r) => r.scope))].map((s) => `${s}(${pickedT.filter((r) => r.scope === s).length})`).join(' ')}`);
L.push(` *    排除 ${skippedT.length} 行:对应字段/面板本地已不存在(下架或改名后的孤儿译名)。`);
L.push(` *`);
L.push(` * 幂等:两条 INSERT 都带 NOT EXISTS 守卫(按业务键判重),重复执行 = 0 行;两账套均执行。`);
L.push(` * 自检:末尾核对 33/20 行到位,不符即 RAISERROR 16(脚本不登记,下次重跑)。`);
L.push(` * 生成器:tools/archive/_gen-srv-config-sync-20261017.mjs(改口径重跑生成,勿手改本文件)。`);
L.push(` */`);
L.push(`SET NOCOUNT ON;`);
L.push(`GO`);
L.push(``);
L.push(`/* ═══ ① yj_field:${picked.length} 行(备用列 → 自定义标签) ═══ */`);
L.push(`DECLARE @f TABLE (`);
// ⚠ 别用 sysname:它是 nvarchar(128) **NOT NULL**,而 ref_field/display_field 在源数据里就是 NULL
//   (实测报 "Cannot insert the value NULL into column 'ref_field', table '@f'")。
L.push(`  panel_code varchar(40), col_name nvarchar(256), label nvarchar(120), data_type nvarchar(40), dict_sql nvarchar(1000),`);
L.push(`  ref_panel varchar(40), ref_field nvarchar(256), display_field nvarchar(256), place varchar(60), seq int, width int,`);
L.push(`  editable bit, required bit, hidden bit, alias nvarchar(120), visible bit, label_en nvarchar(400),`);
L.push(`  col_group nvarchar(100), ref_filter nvarchar(400), tab_key nvarchar(100));`);
if (picked.length) {
  L.push(`INSERT INTO @f VALUES`);
  picked.forEach((r, i) => {
    const vals = [
      escV(r.panel_code), esc(r.col_name), esc(r.label), esc(r.data_type), esc(r.dict_sql),
      esc(r.ref_panel), esc(r.ref_field), esc(r.display_field), escV(r.place), num(r.seq), num(r.width, 120),
      bit(r.editable), bit(r.required), bit(r.hidden), esc(r.alias), bit(r.visible), esc(r.label_en),
      esc(r.col_group), esc(r.ref_filter), esc(r.tab_key),
    ];
    L.push(`  (${vals.join(', ')})${i === picked.length - 1 ? ';' : ','}`);
  });
}
L.push(`INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,`);
L.push(`                       place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key)`);
L.push(`SELECT panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,`);
L.push(`       place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key`);
L.push(`  FROM @f s`);
L.push(` WHERE NOT EXISTS (SELECT 1 FROM yj_field x`);
L.push(`                    WHERE RTRIM(x.panel_code) = RTRIM(s.panel_code) AND RTRIM(x.col_name) = RTRIM(s.col_name));`);
L.push(`GO`);
L.push(``);
L.push(`/* ═══ ② yj_translation:${pickedT.length} 行(服务器独有、本地仍有引用的译名) ═══ */`);
L.push(`DECLARE @t TABLE (scope varchar(20), ref_key nvarchar(400), locale varchar(10), text nvarchar(1000), source varchar(10));`);
if (pickedT.length) {
  L.push(`INSERT INTO @t VALUES`);
  pickedT.forEach((r, i) => {
    L.push(`  (${escV(r.scope)}, ${esc(r.ref_key)}, ${escV(r.locale)}, ${esc(r.text)}, ${escV(r.source || 'manual')})${i === pickedT.length - 1 ? ';' : ','}`);
  });
}
L.push(`INSERT INTO yj_translation (scope, ref_key, locale, text, source, created_at, updated_at)`);
L.push(`SELECT scope, ref_key, locale, text, source, GETDATE(), GETDATE() FROM @t s`);
L.push(` WHERE NOT EXISTS (SELECT 1 FROM yj_translation x`);
L.push(`                    WHERE RTRIM(x.scope) = RTRIM(s.scope) AND x.ref_key = s.ref_key AND RTRIM(x.locale) = RTRIM(s.locale));`);
L.push(`GO`);
L.push(``);
L.push(`/* ═══ 自检 ═══ */`);
L.push(`DECLARE @bad int = 0, @dbn sysname = DB_NAME();`);
if (picked.length) {
  L.push(`DECLARE @nf int = (SELECT COUNT(*) FROM yj_field WHERE col_name LIKE N'备用%' AND label NOT LIKE N'备用%' AND panel_code IN (${[...new Set(picked.map((r) => r.panel_code))].map(escV).join(', ')}));`);
  L.push(`IF @nf < ${picked.length} SET @bad = @bad + 1;`);
} else {
  L.push(`DECLARE @nf int = 0;`);
}
if (pickedT.length) {
  L.push(`DECLARE @nt int = (SELECT COUNT(*) FROM yj_translation WHERE (${pickedT.map((r) => `(scope=${escV(r.scope)} AND ref_key=${esc(r.ref_key)} AND locale=${escV(r.locale)})`).join(' OR ')}));`);
  L.push(`IF @nt < ${pickedT.length} SET @bad = @bad + 1;`);
} else {
  L.push(`DECLARE @nt int = 0;`);
}
L.push(`RAISERROR(N'[自检] %s:备用列自定义标签字段 %d 行(应 ≥ ${picked.length})、同步译名 %d 行(应 ≥ ${pickedT.length});不符 %d 条', 10, 1, @dbn, @nf, @nt, @bad);`);
L.push(`IF @bad = 0 RAISERROR(N'[OK] 服务器端配置改动已同步(备用列自定义标签 + 译名)', 10, 1);`);
L.push(`ELSE RAISERROR(N'[FAIL] 服务器端配置同步自检未过', 16, 1);`);
L.push(`GO`);
L.push(``);

const outPath = join(ROOT, 'tools', 'migrate-srv-config-sync-20261017.sql');
writeFileSync(outPath, L.join('\r\n'), 'utf8');
console.log(`生成 ${outPath}`);
console.log(`  yj_field 行数      : ${picked.length}(面板 ${[...new Set(picked.map((r) => r.panel_code))].join('/')})`);
console.log(`  yj_translation 行数: ${pickedT.length}`);
console.log(`  跳过的字段行 ${skipped.length} 条:`);
for (const [k, n] of skipReasons) console.log(`     ${k} × ${n}`);
console.log(`  跳过的译名 ${skippedT.length} 条(${[...new Set(skippedT.map(([, w]) => w))].join(' / ')})`);
await ref.close(); await tgt.close();
