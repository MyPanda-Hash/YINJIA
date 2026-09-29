#!/usr/bin/env node
/**
 * 表使用面判定探针 v3(只读;任务产物)。
 *
 * 「在运营面板」三源并集(任一命中即视为在运营):
 *   1) 前端菜单真源 frontend/src/business/menus.js 里**未注释**的 panelCode
 *   2) yj_role_panel 已授权 view 的面板
 *   3) 前后端代码里被引用的 panelCode(弹窗/跳转/参照等非菜单入口)
 * 「在用表」四源并集:
 *   P 被在运营面板绑定(head_table / line_table)
 *   V 被「在运营面板绑定的视图」引用(含视图嵌套)
 *   C 后端/前端代码引用
 *   D 有数据行(business data)
 * 其余按下架面板挂靠 / 有数据无引用 / 空表 分类;RENAME_/_bak_/tmp_/t1/t2/log 归备份临时。
 *
 * 输入:archive\_table-audit\{objects,panels,deps,refs,granted}.csv
 * 输出:classify.csv + summary.txt
 * 用法(在 tools 目录下):node archive\_table-classify.cjs
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '_table-audit');
const ROOT = path.resolve(__dirname, '..', '..');

function parseCsv(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const rows = [];
  let cur = [], field = '', inQ = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (inQ) {
      if (ch === '"') { if (txt[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { cur.push(field); field = ''; }
    else if (ch === '\n') { cur.push(field); field = ''; rows.push(cur); cur = []; }
    else if (ch !== '\r') field += ch;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  const head = rows.shift();
  return rows.filter(r => r.length && r.some(v => v !== '')).map(r => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i] === undefined ? '' : r[i]; });
    return o;
  });
}

const objects = parseCsv(path.join(DIR, 'objects.csv'));
const panels = parseCsv(path.join(DIR, 'panels.csv'));
const deps = parseCsv(path.join(DIR, 'deps.csv'));
const refs = parseCsv(path.join(DIR, 'refs.csv'));
const granted = parseCsv(path.join(DIR, 'granted.csv'));
const refByName = new Map(refs.map(r => [r.table, r]));

// ---- 在运营面板
const menuSrc = fs.readFileSync(path.join(ROOT, 'frontend/src/business/menus.js'), 'utf8');
const menuPanels = new Set([...menuSrc.matchAll(/panelCode:\s*'([^']+)'/g)].map(m => m[1]));
const grantPanels = new Set(granted.filter(g => /view/.test(g.perms)).map(g => g.panel_code));
// 参照目标面板:被「活的面板」当参照源的面板同样是活的面板(如 RKD/CKD 的仓库参照指向 CKDA);
// 参照链可多级,迭代到不动点
const refFields = parseCsv(path.join(DIR, 'fieldcols.csv'))
  .filter(r => (r.ref_panel || '').trim())
  .map(r => ({ panel: r.panel_code.trim(), ref: r.ref_panel.trim() }));
let refTargets = new Set(refFields.map(r => r.ref));

const panelTables = new Map(), tablePanels = new Map();
for (const p of panels) {
  const ts = [p.head_table, p.line_table].map(s => (s || '').trim()).filter(Boolean);
  panelTables.set(p.panel_code, ts);
  for (const t of ts) {
    if (!tablePanels.has(t)) tablePanels.set(t, new Set());
    tablePanels.get(t).add(p.panel_code);
  }
}
const allCodes = panels.map(p => p.panel_code);
// ---- 代码里引用的 panelCode
function scanPanelRefs(dir, acc) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'target', 'dist', 'archive'].includes(e.name)) scanPanelRefs(p, acc); }
    else if (/\.(java|js|vue|cjs|mjs)$/.test(e.name)) {
      let txt = '';
      try { txt = fs.readFileSync(p, 'utf8'); } catch { }
      for (const c of allCodes) if (txt.includes(c)) acc.add(c);
    }
  }
  return acc;
}
const codePanels = new Set();
scanPanelRefs(path.join(ROOT, 'frontend/src'), codePanels);
scanPanelRefs(path.join(ROOT, 'backend/src'), codePanels);

const livePanels = new Set([...menuPanels, ...grantPanels, ...codePanels, ...refTargets]);
// 不动点:活的面板引用的参照目标也是活的(多级参照链)
for (let i = 0; i < 10; i++) {
  let grew = false;
  for (const f of refFields) if (livePanels.has(f.panel) && !livePanels.has(f.ref)) { livePanels.add(f.ref); grew = true; }
  if (!grew) break;
}
const pick = (set) => [...set].filter(c => livePanels.has(c));
const liveTables = new Set(), retiredTables = new Set();
for (const [t, ps] of tablePanels) {
  for (const pc of ps) (livePanels.has(pc) ? liveTables : retiredTables).add(t);
}
// ---- 视图 -> 基表
const viewToBase = new Map();
for (const d of deps) {
  const r = (d.referencing || '').trim(), t = (d.referenced || '').trim();
  if (!r || !t || r === t) continue;
  if (!viewToBase.has(r)) viewToBase.set(r, new Set());
  viewToBase.get(r).add(t);
}
const kinds = new Map(objects.map(o => [o.name, o.kind]));
const liveViews = new Set();
for (const pc of livePanels) for (const t of panelTables.get(pc) || []) if (kinds.get(t) === 'VIEW') liveViews.add(t);
const viewUse = new Map();
function walkView(v, seen) {
  if (seen.has(v)) return;
  seen.add(v);
  for (const b of viewToBase.get(v) || []) {
    if (!viewUse.has(b)) viewUse.set(b, new Set());
    viewUse.get(b).add(v);
    walkView(b, seen);
  }
}
for (const v of liveViews) walkView(v, new Set());

const BACKUP_RE = /^(RENAME_)|_bak_|^tmp_|^t1$|^t2$|^log$/i;
const PREFIX_MES = /^(yj_|bs_|bd_|bl_|rd_|qc_|wo_)/;
const MES_UNPREFIXED = new Set(['day_report', 'day_report_detail', 'equip_check', 'equip_check_detail', 'feed_confirm',
  'feed_confirm_detail', 'gran_record', 'gran_record_detail', 'maint_plan', 'maint_plan_detail', 'mix_record',
  'mix_record_detail', 'pack_confirm', 'pack_confirm_detail', 'qr_batch_registry', 'rod_return', 'rod_return_detail',
  'sample_req', 'sample_req_detail', 'wh_record', 'wh_record_detail', 'sl_recv', 'sl_recv_detail', 'inv_cost_ledger',
  'form_flow_link', 'report_column_settings', 'erp_imp_log', 'erp_imp_row', 's_allno']);

const out = [];
for (const o of objects) {
  if (o.kind !== 'TABLE') continue;
  const t = o.name;
  const ps = [...(tablePanels.get(t) || [])].sort();
  const live = pick(ps), retired = ps.filter(p => !livePanels.has(p));
  const vw = [...(viewUse.get(t) || [])].sort();
  const ref = refByName.get(t) || { sql_refs: '0', sql_refs_biz: '0', panel_refs: '0', mentions: '0', sample_files: '' };
  const biz = Number(ref.sql_refs_biz), mentions = Number(ref.mentions), sqlAll = Number(ref.sql_refs);
  const code = biz;
  const rows = Number(o.row_count), spare = Number(o.spare_cols);
  const mes = PREFIX_MES.test(t) || MES_UNPREFIXED.has(t);

  let cls;
  if (BACKUP_RE.test(t)) cls = 'X_备份临时';
  else if (live.length || vw.length || code > 0) cls = mes ? 'A_在用_MES自有' : 'B_在用_经典遗留';
  else if (retired.length) cls = 'C_仅下架面板挂靠';
  else if (rows > 0) cls = 'D_有数据无引用';
  else cls = mes ? 'E_空表_MES未接线' : 'F_空表_遗留未用';

  out.push({ table: t, cls, livePanels: live.join(' '), retiredPanels: retired.join(' '), views: vw.join(' '),
             code, sqlAll, mentions, rows, cols: o.col_count, spare,
             desc: o.ms_description, samples: ref.sample_files });
}

out.sort((a, b) => a.cls.localeCompare(b.cls) || a.table.localeCompare(b.table));
const esc = s => '"' + String(s).replace(/"/g, '""') + '"';
fs.writeFileSync(path.join(DIR, 'classify.csv'),
  'table,class,live_panels,retired_panels,used_views,sql_refs_biz,sql_refs_all,mentions,rows,cols,spare,ms_description,sample_files\n'
  + out.map(r => [esc(r.table), r.cls, esc(r.livePanels), esc(r.retiredPanels), esc(r.views), r.code, r.sqlAll,
      r.mentions, r.rows, r.cols, r.spare, esc(r.desc), esc(r.samples)].join(',')).join('\n') + '\n', 'utf8');

const byCls = new Map();
for (const r of out) byCls.set(r.cls, (byCls.get(r.cls) || 0) + 1);
const L = [];
L.push(`在运营面板: ${livePanels.size}(菜单 ${menuPanels.size} / 授权 ${grantPanels.size} / 代码引用 ${codePanels.size} 之并集)`);
L.push(`在运营视图: ${liveViews.size}`);
L.push('');
L.push(`== 分类统计(共 ${out.length} 张表)==`);
for (const [k, v] of [...byCls].sort()) L.push(`  ${k}: ${v}`);
const keep = out.filter(r => /^[AB]_/.test(r.cls));
L.push('');
L.push(`== 在用表合计 ${keep.length} 张(MES 自有 ${keep.filter(r => r.cls[0] === 'A').length} / 经典遗留 ${keep.filter(r => r.cls[0] === 'B').length})==`);
const noSpare = keep.filter(r => r.spare !== 20);
L.push(`  已有 20 备用列: ${keep.length - noSpare.length} 张;缺: ${noSpare.length} 张`);
for (const r of noSpare) L.push(`    ${r.table}\tspare=${r.spare}\trows=${r.rows}\tcols=${r.cols}\tpanels=[${r.livePanels}]\tviews=[${r.views}]`);
for (const c of ['C_仅下架面板挂靠', 'D_有数据无引用', 'E_空表_MES未接线', 'F_空表_遗留未用', 'X_备份临时']) {
  const g = out.filter(r => r.cls === c);
  L.push('');
  L.push(`== ${c} (${g.length}) ==`);
  L.push('  ' + g.map(r => `${r.table}${r.rows ? '(rows=' + r.rows + ')' : ''}`).join(' '));
}
const sum = L.join('\n') + '\n';
fs.writeFileSync(path.join(DIR, 'summary.txt'), sum, 'utf8');
console.log(sum);
