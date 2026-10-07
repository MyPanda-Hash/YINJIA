// _gen-converge.cjs — 生成 migrate-server-converge-20261007.sql(一次性探针)
// 依据:演练库(服务器 bak + 全链 76 条)与本地正式库的全结构/元数据对账残差
const fs = require('fs');
const D = __dirname;
const read = f => fs.readFileSync(D + '/' + f, 'utf8').split(/\r?\n/);
const esc = s => s.replace(/'/g, "''");
const N = s => (s === 'NULL' || s === '' ? 'NULL' : `N'${esc(s)}'`);
const sec = (lines, name, minFields) => {
  const out = []; let on = false;
  for (const l of lines) {
    if (l.startsWith('==')) { on = (l === '==' + name + '=='); continue; }
    if (!on) continue;
    if (!l.trim() || !l.includes('|')) continue;
    const p = l.split('|');
    if (p.some(f => /^-+$/.test(f.trim()))) continue;          // 表头分隔线
    if (p.length < minFields || p.length > minFields) continue; // 错位行(值含分隔符)宁可丢弃不可错插
    if (['panel_code','tbl','role_code','scope'].includes(p[0])) continue;
    out.push(p);
  }
  return out;
};
// ── 1) 缺失列 ──
const colspec = sec(read('conv-colspec.txt'), 'COLSPEC', 7).map(p => ({
  tbl: p[0], col: p[1], tp: p[2], ml: +p[3], pr: +p[4], sc: +p[5], nul: p[6] === '1'
}));
const typeSpec = c => {
  const t = c.tp.toLowerCase();
  if (t === 'nvarchar' || t === 'nchar') return `${c.tp}(${c.ml === -1 ? 'max' : c.ml / 2})`;
  if (t === 'varchar' || t === 'char' || t === 'varbinary' || t === 'binary') return `${c.tp}(${c.ml === -1 ? 'max' : c.ml})`;
  if (t === 'decimal' || t === 'numeric') return `${c.tp}(${c.pr},${c.sc})`;
  if (t === 'datetime2' || t === 'time' || t === 'datetimeoffset') return `${c.tp}(${c.sc})`;
  if (t === 'float') return c.ml <= 8 ? 'float(53)' : 'float(53)';
  return c.tp;
};
// ── 2) yj_field 缺失/多余 ──
const fm = sec(read('conv-meta.txt'), 'FIELD_MISSING', 16).map(p => ({
  panel: p[0], col: p[1], label: p[2], dt: p[3], dict: p[4], refp: p[5], reff: p[6], disp: p[7],
  place: p[8], seq: p[9], w: p[10], ed: p[11], req: p[12], hid: p[13], vis: p[14], tab: p[15]
}));
const fe = sec(read('conv-meta2.txt'), 'FIELD_EXTRA', 3).map(p => ({ panel: p[0], col: p[1], place: p[2] }));
// ── 3) yj_panel 缺失 ──
const pcCols = ['panel_code','panel_name','category','mode','line_table','head_table','group_col','pk_col','code_col','prefix','date_col','page_size','detail_key','module_group','config','config_at','panel_name_en'];
const prow = read('conv-panel.txt'); let pRow = null, onP = false;
for (const l of prow) { if (l.startsWith('==PANELROW==')) { onP = true; continue; } if (onP && l.includes('|') && !l.startsWith('panel_code|') && !/^-/.test(l)) { pRow = l.split('|'); break; } }
// ── 4) role / role_panel ──
const rm = sec(read('conv-meta2.txt'), 'ROLE_MISSING', 3).map(p => ({ code: p[0], name: p[1], admin: p[2] }));
const rpm = sec(read('conv-meta2.txt'), 'ROLEPANEL_MISSING', 4).map(p => ({ code: p[0], panel: p[1], perms: p[2], ca: p[3] }));
// ── 5) translation ──
const tm = sec(read('conv-meta2.txt'), 'TRANS_MISSING', 5).map(p => ({ scope: p[0], key: p[1], loc: p[2], text: p[3], src: p[4] }));

let out = [];
out.push(`/* migrate-server-converge-20261007.sql — 服务器收敛(第四轮 parity):结构+元数据对齐到本地(2026-10-07)
 * 背景:服务器 yj_schema_log 存在 09-30 22:03 批量 baseline 登记(applied_at 同毫秒),部分已登记脚本效果缺失;
 *   演练(服务器 bak+全链 76 条)后与本地全对账,残差=57 列/6 表 + yj_field 缺 ${fm.length} 多 ${fe.length} + yj_panel 缺 1
 *   + yj_role 缺 ${rm.length} + yj_role_panel 缺 ${rpm.length} + yj_translation 缺 ${tm.length}。
 * 本脚本(全部幂等守卫):①按本地类型补 57 列;②删服务器多余 yj_field 行;③补缺 yj_field/yj_panel/yj_role/
 *   yj_role_panel(经 role_code 映射 id)/yj_translation。业务数据(yj_doc_status/yj_user/yj_doc_batch 等)不碰。
 * 证据:tools/archive/_srv-bak-compare-20261007/(rehearsal2-finaldiff.txt/conv-*.txt)。两账套均执行(测试库=对齐校准)。 */`);
out.push(`SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO`);
out.push(`-- ===== ① 补缺失列(${colspec.length} 列,类型/可空性照抄本地) =====`);
out.push(`DECLARE @c int = 0;`);
for (const c of colspec) {
  out.push(`IF OBJECT_ID(N'dbo.${c.tbl}', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.${c.tbl}', N'${esc(c.col)}') IS NULL BEGIN ALTER TABLE dbo.${c.tbl} ADD [${esc(c.col)}] ${typeSpec(c)} ${c.nul ? 'NULL' : 'NOT NULL'}; SET @c += 1; END`);
}
out.push(`PRINT N'① 补列 ' + CAST(@c AS nvarchar) + N'/' + CAST(${colspec.length} AS nvarchar) + N'(其余已存在)';
GO`);
out.push(`-- ===== ② 删服务器多余 yj_field 行(${fe.length} 组键;本地无同键行,直删安全) =====`);
out.push(`DECLARE @d int = 0;`);
for (const r of fe) {
  out.push(`DELETE FROM yj_field WHERE panel_code=N'${esc(r.panel)}' AND col_name=N'${esc(r.col)}' AND ISNULL(place,N'')=N'${esc(r.place)}'; SET @d += 1;`);
}
out.push(`PRINT N'② 删多余字段行 ' + CAST(@d AS nvarchar) + N'(每行实际删除数见消息)';
GO`);
out.push(`-- ===== ③ 补缺 yj_field(${fm.length}) =====`);
const CH = 200;
for (let i = 0; i < fm.length; i += CH) {
  out.push(`INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible, tab_key)`);
  out.push(`SELECT v.* FROM (VALUES`);
  out.push(fm.slice(i, i + CH).map(r => `(${N(r.panel)},${N(r.col)},${N(r.label)},${N(r.dt)},${N(r.dict)},${N(r.refp)},${N(r.reff)},${N(r.disp)},${N(r.place)},${r.seq === 'NULL' ? 'NULL' : r.seq},${r.w === 'NULL' ? 'NULL' : r.w},${r.ed === 'NULL' ? 'NULL' : r.ed},${r.req === 'NULL' ? 'NULL' : r.req},${r.hid === 'NULL' ? 'NULL' : r.hid},${r.vis === 'NULL' ? 'NULL' : r.vis},${N(r.tab)})`).join(',\n'));
  out.push(`) v(panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible, tab_key)`);
  out.push(`WHERE NOT EXISTS (SELECT 1 FROM yj_field g WHERE g.panel_code=v.panel_code AND g.col_name=v.col_name AND ISNULL(g.place,N'')=ISNULL(v.place,N''));`);
  out.push(`GO`);
}
out.push(`-- ===== ④ 补缺 yj_panel(RD_SHARE_FILE) =====`);
out.push(`INSERT INTO yj_panel (${pcCols.join(', ')}) SELECT v.* FROM (VALUES`);
out.push(`(${pRow.map(v => (/^-?\d+$/.test(v) ? v : N(v))).join(',')})`);
out.push(`) v(${pcCols.join(', ')}) WHERE NOT EXISTS (SELECT 1 FROM yj_panel g WHERE g.panel_code='RD_SHARE_FILE');
GO`);
out.push(`-- ===== ⑤ 补缺 yj_role(${rm.length}) =====`);
for (const r of rm) {
  out.push(`IF NOT EXISTS (SELECT 1 FROM yj_role g WHERE g.role_code=N'${esc(r.code)}') INSERT INTO yj_role (role_code, role_name, is_admin) VALUES (N'${esc(r.code)}', N'${esc(r.name)}', ${/^-?[0-9]+$/.test(r.admin) ? r.admin : N(r.admin)});`);
}
out.push(`-- ===== ⑥ 补缺 yj_role_panel(${rpm.length},经 role_code 映射服务器侧 role_id) =====`);
for (const r of rpm) {
  out.push(`INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve) SELECT r.id, v.panel_code, v.perms, v.ca FROM yj_role r JOIN (VALUES (N'${esc(r.code)}', N'${esc(r.panel)}', ${N(r.perms)}, ${/^-?\d+$/.test(r.ca) ? r.ca : N(r.ca)})) v(role_code, panel_code, perms, ca) ON r.role_code=v.role_code WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel g JOIN yj_role gr ON gr.id=g.role_id WHERE gr.role_code=N'${esc(r.code)}' AND g.panel_code=N'${esc(r.panel)}');`);
}
out.push(`-- ===== ⑦ 补缺 yj_translation(${tm.length}) =====`);
for (let i = 0; i < tm.length; i += CH) {
  out.push(`INSERT INTO yj_translation (scope, ref_key, locale, text, source)`);
  out.push(`SELECT v.scope, v.ref_key, v.locale, v.text, v.source FROM (VALUES`);
  out.push(tm.slice(i, i + CH).map(r => `(${N(r.scope)},${N(r.key)},${N(r.loc)},${N(r.text)},${N(r.src)})`).join(',\n'));
  out.push(`) v(scope, ref_key, locale, text, source)`);
  out.push(`WHERE NOT EXISTS (SELECT 1 FROM yj_translation g WHERE g.scope=v.scope AND g.ref_key=v.ref_key AND g.locale=v.locale);`);
  out.push(`GO`);
}
out.push(`-- ===== ⑧ 删服务器多出的面板 CKDA(旧「仓库档案」,本地已由 WHLOC/bs_wh 替代;dm_ck 表保留) =====`);
out.push(`DELETE FROM yj_role_panel WHERE panel_code='CKDA';`);
out.push(`DELETE FROM yj_field WHERE panel_code='CKDA';`);
out.push(`DELETE FROM yj_panel WHERE panel_code='CKDA';`);
out.push(`PRINT N'⑧ CKDA 面板元数据已删除(dm_ck 表保留,legacy 引用不变)';
GO`);
out.push(`PRINT N'== converge-20261007 完成:列/字段/面板/角色/授权/译名 已对齐本地 ==';
GO`);
fs.writeFileSync('tools/migrate-server-converge-20261007.sql', out.join('\n') + '\n');
console.log(`生成: 列 ${colspec.length} | field缺 ${fm.length} 多 ${fe.length} | panel 1 | role ${rm.length} | role_panel ${rpm.length} | trans ${tm.length}`);
