#!/usr/bin/env node
/**
 * 待删表风险核查探针(只读;任务产物)。
 *
 * 对分类为「未用」的表(C_仅下架面板挂靠 / D_有数据无引用 / E_空表_MES未接线 / F_空表_遗留未用,
 * 可选 X_备份临时)逐张核查三类风险:
 *   1) 被「在运营视图」引用           -> DROP 会打坏在跑的报表 → 判定 KEEP_FOR_VIEW
 *   2) 运行期代码有 SQL 位置引用       -> 判定 REVIEW(人工看过再删)
 *   3) runtime 无引用但被注释/字符串提及 -> 记录提及文件,默认可删(需人工扫一眼样本)
 * 另外登记:是否有 yj_panel/yj_field 元数据仍指向该表(删表后元数据悬空,需一并清理)。
 *
 * 用法(在 tools 目录下):node archive\_table-drop-risk.cjs [含X组=1]
 * 输出:archive\_table-audit\drop-risk.csv + 控制台摘要
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '_table-audit');

function parseCsv(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const rows = []; let cur = [], field = '', inQ = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (inQ) { if (ch === '"') { if (txt[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === ',') { cur.push(field); field = ''; }
    else if (ch === '\n') { cur.push(field); field = ''; rows.push(cur); cur = []; }
    else if (ch !== '\r') field += ch;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  const head = rows.shift();
  return rows.filter(r => r.length && r.some(v => v !== '')).map(r => {
    const o = {}; head.forEach((h, i) => { o[h] = r[i] === undefined ? '' : r[i]; }); return o;
  });
}

const cls = parseCsv(path.join(DIR, 'classify.csv'));
const panels = parseCsv(path.join(DIR, 'panels.csv'));
const deps = parseCsv(path.join(DIR, 'deps.csv'));
const objects = parseCsv(path.join(DIR, 'objects.csv'));
const withX = process.argv[2] === '1';

// 在运营视图(分类时用的是同一口径:被在运营面板绑定的视图)
const livePanels = new Set();
{
  // classify.csv 的 live_panels 只是表侧;视图侧这里用 deps 反查:凡被「非未用表」引用的视图视为在用
  const keep = new Set(cls.filter(r => /^[AB]_/.test(r.class)).map(r => r.table));
  for (const p of panels) if (keep.has((p.line_table || '').trim()) || keep.has((p.head_table || '').trim())) livePanels.add(p.panel_code);
}
const keepTables = new Set(cls.filter(r => /^[AB]_/.test(r.class)).map(r => r.table));
const viewRefs = new Map(); // 表 -> 引用它的视图集合
for (const d of deps) {
  const r = (d.referencing || '').trim(), t = (d.referenced || '').trim();
  if (!r || !t || r === t) continue;
  if (!viewRefs.has(t)) viewRefs.set(t, new Set());
  viewRefs.get(t).add(r);
}
const kind = new Map(objects.map(o => [o.name, o.kind]));

const targets = cls.filter(r => (withX ? /^[CDEFX]_/ : /^[CDEF]_/).test(r.class));
const rows = [];
for (const r of targets) {
  const views = [...(viewRefs.get(r.table) || [])];
  const liveView = views.filter(v => kind.get(v) === 'VIEW' && (livePanels.has(v) || [...panels].some(p => (p.line_table || '').trim() === v && livePanels.has(p.panel_code))));
  const viewsLive = views.filter(v => !targets.some(t => t.table === v)); // 引用方自身不在待删集合 => 存活视图
  let verdict = 'DROP';
  if (liveView.length) verdict = 'KEEP_被在运营视图引用';
  else if (Number(r.sql_refs_biz) > 0) verdict = 'REVIEW_运行期代码有SQL引用';
  else if (viewsLive.length) verdict = 'DROP_存活视图失效(视图自身未在用)';
  else if (Number(r.mentions) > 0) verdict = 'DROP_仅注释/字符串提及';
  rows.push({ table: r.table, class: r.class, rows: r.rows, cols: r.cols, verdict,
              sql_refs_biz: r.sql_refs_biz, mentions: r.mentions,
              views: views.join(' '), panels: (r.retired_panels || ''), samples: r.sample_files });
}

const esc = s => '"' + String(s).replace(/"/g, '""') + '"';
fs.writeFileSync(path.join(DIR, 'drop-risk.csv'),
  'table,class,rows,cols,verdict,sql_refs_biz,mentions,referencing_views,retired_panels,sample_files\n'
  + rows.map(r => [esc(r.table), r.class, r.rows, r.cols, r.verdict, r.sql_refs_biz, r.mentions, esc(r.views), esc(r.panels), esc(r.samples)].join(',')).join('\n') + '\n', 'utf8');

const by = new Map();
for (const r of rows) by.set(r.verdict, (by.get(r.verdict) || 0) + 1);
console.log(`待核查 ${rows.length} 张${withX ? '(含 X 备份临时)' : ''}`);
for (const [k, v] of [...by].sort()) console.log(`  ${k}: ${v}`);
const review = rows.filter(r => r.verdict.startsWith('REVIEW') || r.verdict.startsWith('KEEP'));
console.log('\n== 需人工确认 ==');
for (const r of review) console.log(`  ${r.table} [${r.verdict}] rows=${r.rows} views=${r.views || '-'} samples=${r.samples}`);
const viewBroken = rows.filter(r => r.verdict.startsWith('DROP_存活视图'));
console.log('\n== 删后会让「未在用视图」失效的表 ==');
for (const r of viewBroken) console.log(`  ${r.table}: ${r.views}`);
