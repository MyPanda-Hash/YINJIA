/**
 * _q-srv-vs-local-detail-20261017.mjs — 上一支对比的**细分**:服务器独有的字段/译名到底落在哪些面板上(只读)。
 *
 * 目的:判定「服务器有、本地没有」的这些行,是**真缺口**(面板还在、字段/译名本地却缺)
 * 还是**本地有意改动**(面板已下架、字段已改名)。分类口径:
 *   · 面板在本地 yj_panel 里不存在 ⇒ 归「面板已下架(本地有意)」
 *   · 面板还在、但同面板同 label 的本地行用了别的 col_name ⇒ 归「改名(本地有意)」
 *   · 面板还在且没有任何同 label 行 ⇒ 归「**真缺口**(需同步)」
 * 译名同理:ref_key 在本地 yj_panel/yj_field 里是否还有引用。
 *
 * 只读。用法:node tools/archive/_q-srv-vs-local-detail-20261017.mjs
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
  pool: { max: 4 }, requestTimeout: 300000,
});
const q = async (p, s) => (await p.request().query(s)).recordset;

const ref = await conn('HSDZ_MES_SRV1015').connect();
const tgt = await conn('HSDZ_MES').connect();
const out = []; const say = (s = '') => out.push(s);

// ── 1. 服务器独有 yj_field 的归属 ──
const F = `SELECT RTRIM(panel_code) AS p, RTRIM(col_name) AS c, RTRIM(label) AS l, RTRIM(place) AS pl FROM yj_field`;
const refF = await q(ref, F), tgtF = await q(tgt, F);
const tgtPanels = new Set((await q(tgt, `SELECT RTRIM(panel_code) AS p FROM yj_panel`)).map((r) => r.p));
const tgtByPanelLabel = new Map();
for (const r of tgtF) tgtByPanelLabel.set(`${r.p}|${r.l}`, r);
const onlyRefF = refF.filter((r) => !tgtF.some((x) => x.p === r.p && x.c === r.c && x.pl === r.pl));
const cat = { 面板已下架: [], 改名: [], 真缺口: [] };
for (const r of onlyRefF) {
  if (!tgtPanels.has(r.p)) cat.面板已下架.push(r);
  else if (tgtByPanelLabel.has(`${r.p}|${r.l}`)) cat.改名.push(r);
  else cat.真缺口.push(r);
}
say(`=== 1. 服务器独有 yj_field 共 ${onlyRefF.length} 条 ===`);
for (const k of ['真缺口', '改名', '面板已下架']) {
  const g = new Map();
  for (const r of cat[k]) g.set(r.p, (g.get(r.p) || 0) + 1);
  say(`  ${k}: ${cat[k].length} 条` + (g.size ? `  按面板: ${[...g].map(([p, n]) => `${p}(${n})`).join(' ')}` : ''));
}
say(`  ── 「真缺口」逐条(面板还在本地、同 label 也没有):`);
for (const r of cat.真缺口) say(`     ${r.p} | ${r.c} | label=${r.l} | place=${r.pl}`);
say(`  ── 「改名」逐条(同面板同 label,本地换了 col_name ⇒ 本地有意改名):`);
for (const r of cat.改名) say(`     ${r.p} | ${r.c} → 本地 ${tgtByPanelLabel.get(`${r.p}|${r.l}`).c}`);

// ── 2. 服务器独有 yj_translation 的归属 ──
const T = `SELECT RTRIM(scope) AS s, ref_key AS k, RTRIM(locale) AS lo, RTRIM(CAST(text AS nvarchar(200))) AS t FROM yj_translation`;
const refT = await q(ref, T), tgtT = await q(tgt, T);
const tgtTKeys = new Set(tgtT.map((r) => `${r.s}|${r.k}|${r.lo}`));
const onlyRefT = refT.filter((r) => !tgtTKeys.has(`${r.s}|${r.k}|${r.lo}`));
// ref_key 在本地还有没有引用(panel 名 / field label)
const localPanelNames = new Set((await q(tgt, `SELECT RTRIM(panel_code) AS p, RTRIM(ISNULL(panel_name,'')) AS n FROM yj_panel`)).flatMap((r) => [r.p, r.n]));
const localLabels = new Set(tgtF.map((r) => r.l));
const t2 = { panel在用: [], panel已下架: [], field在用: [], field已无引用: [], 其它: [] };
for (const r of onlyRefT) {
  if (r.s === 'panel') (localPanelNames.has(r.k) ? t2.panel在用 : t2.panel已下架).push(r);
  else if (r.s === 'field') (localLabels.has(r.k) ? t2.field在用 : t2.field已无引用).push(r);
  else t2.其它.push(r);
}
say('');
say(`=== 2. 服务器独有 yj_translation 共 ${onlyRefT.length} 条 ===`);
for (const [k, v] of Object.entries(t2)) say(`  ${k}: ${v.length} 条`);
say(`  ── 「field 在用」(本地还有该 label 的字段行,但缺这条译名 = 真缺口)按 locale 统计:`);
{
  const g = new Map();
  for (const r of t2.field在用) g.set(r.lo, (g.get(r.lo) || 0) + 1);
  say(`     ${[...g].map(([l, n]) => `${l}(${n})`).join(' ') || '(无)'}`);
  const uniq = new Map();
  for (const r of t2.field在用) if (!uniq.has(r.k)) uniq.set(r.k, r);
  say(`     涉及 ${uniq.size} 个标签,前 40 个: ${[...uniq.keys()].slice(0, 40).join(' / ')}`);
}
say(`  ── 「panel 在用」逐条:`);
for (const r of t2.panel在用) say(`     ${r.s}|${r.k}|${r.lo} = ${r.t}`);

// ── 3. 同名不同属性:按表聚合 + 全量列出 ──
const C = `SELECT CONCAT(s.name,'.',t.name) AS tb, c.name AS col, ty.name AS typ, c.max_length AS ml,
                  c.precision AS pr, c.scale AS sc, c.is_nullable AS nul, c.is_identity AS idn,
                  ISNULL(dc.definition,'') AS def
             FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
             JOIN sys.schemas s ON s.schema_id=t.schema_id
             JOIN sys.types ty ON ty.user_type_id=c.user_type_id
             LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id`;
const sig = (r) => `${r.typ}|${r.ml}|${r.pr}|${r.sc}|${r.nul}|${r.idn}|${r.def}`;
const refC = new Map((await q(ref, C)).map((r) => [`${r.tb}.${r.col}`, r]));
const tgtC = new Map((await q(tgt, C)).map((r) => [`${r.tb}.${r.col}`, r]));
const attr = [];
for (const [k, a] of refC) { const b = tgtC.get(k); if (b && sig(a) !== sig(b)) attr.push([k, a, b]); }
say('');
say(`=== 3. 同名不同属性 ${attr.length} 条(全部) ===`);
for (const [k, a, b] of attr.sort()) {
  const d = [];
  if (a.typ !== b.typ) d.push(`类型 ${a.typ}→${b.typ}`);
  if (a.ml !== b.ml) d.push(`长度 ${a.ml}→${b.ml}`);
  if (a.pr !== b.pr || a.sc !== b.sc) d.push(`精度 ${a.pr},${a.sc}→${b.pr},${b.sc}`);
  if (a.nul !== b.nul) d.push(`可空 ${a.nul}→${b.nul}`);
  if (a.idn !== b.idn) d.push(`自增 ${a.idn}→${b.idn}`);
  if (a.def !== b.def) d.push(`默认 ${a.def || '无'}→${b.def || '无'}`);
  say(`  ${k}  [服务器→本地] ${d.join('; ')}`);
}

writeFileSync(join(ROOT, 'tools', 'archive', '_q-srv-vs-local-detail-20261017.out'), out.join('\n') + '\n', 'utf8');
console.log(out.join('\n'));
await ref.close(); await tgt.close();
