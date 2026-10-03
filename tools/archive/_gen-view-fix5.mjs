// _gen-view-fix5.mjs — 视图缺列修复(第五版·终版):定义源=迁移脚本文件(db-migrations 清单序取最后定义),包裹/前插分类
import fs from 'node:fs';

const bad = {
  DISPATCH_STATS: ['部门'], FINISH_IN_DETAIL: ['创建时间'], FINISH_IN_STATS: ['项目'],
  MANU_ORDER_STATS: ['产品编码'], MATERIAL_OUT_DETAIL: ['创建时间'], MATERIAL_OUT_STATS: ['仓库编码'],
  OTHER_IN_DETAIL: ['创建时间'], OTHER_IN_STATS: ['仓库编码'], OTHER_OUT_DETAIL: ['创建时间'], OTHER_OUT_STATS: ['仓库编码'],
  OUTSOURCE_IN_STATS: ['仓库'], OUTSOURCE_ISSUE_DETAIL: ['发料仓库'], OUTSOURCE_ISSUE_STATS: ['仓库'],
  PURCHASE_IN_STATS: ['仓库编码'], SALE_OUT_DETAIL: ['仓库编码'], SALE_OUT_STATS: ['单据日期（周）'],
  SALES_ORDER_DETAIL: ['存货'], SALES_ORDER_STATS: ['客户编码'],
};
const viewOf = Object.fromEntries(
  fs.readFileSync('tools/archive/_pv.out', 'utf8').split('\n')
    .filter(l => l.includes('|') && !l.startsWith('panel_code') && !l.startsWith('-'))
    .map(l => { const i = l.indexOf('|'); return [l.slice(0, i), l.slice(i + 1).trim()]; }));

// db-migrations 清单顺序(决定同名视图取哪个脚本的定义)
const order = fs.readFileSync('tools/db-migrations.txt', 'utf8').split('\n')
  .map(l => l.trim()).filter(l => l.endsWith('.sql') && !l.startsWith('#'));

// 每视图取"清单序最靠后且定义存在的脚本"里的定义(单行 EXEC('CREATE ...') 或裸 CREATE)
function extractDef(view) {
  for (let i = order.length - 1; i >= 0; i--) {
    const f = 'tools/' + order[i];
    if (!fs.existsSync(f)) continue;
    if (f.includes('fix-db-restore')) continue;  // 多段 EXEC 拼接格式,解析不出完整定义;取 panda 系单行版
    const txt = fs.readFileSync(f, 'utf8');
    const re = new RegExp(`(CREATE(?:\\s+OR\\s+ALTER)?\\s+VIEW\\s+${view}\\s+AS\\s[\\s\\S]*?);`, 'g');
    const hits = [...txt.matchAll(re)];
    if (!hits.length) continue;
    let def = hits[hits.length - 1][1];
    def = def.replace(/''/g, "'").replace(/\s+\n/g, '\n').trim();
    return { def, src: order[i] };
  }
  return null;
}

let sql = `-- migrate-align-views-20260924.sql — 视图缺列兼容修复(2026-09-24 全面板扫描产物)
-- 背景:远程库对报表视图做过库上直改(补布局列)未入迁移链,本地旧版缺输出列 → 面板 500(Invalid column)。
-- 定义源:迁移脚本(按 db-migrations 清单序取最后定义),非库内现状(库内部分已被中间态污染)。
-- 修法:UNION 视图包裹法(外层补列);单段视图首个 FROM 前插列。id 缺口(v_lot_trace)由 migrate-view-id 系列负责。
SET NOCOUNT ON;
`;
let fixed = 0; const skipped = [];
for (const [pc, cols] of Object.entries(bad)) {
  const v = viewOf[pc];
  if (!v) { skipped.push(pc); continue; }
  const got = extractDef(v);
  if (!got) { skipped.push(pc + '(脚本无定义)'); continue; }
  let d = got.def;
  const m = d.match(/^CREATE(?:\s+OR\s+ALTER)?\s+VIEW\s+\S+\s+AS\s+([\s\S]+)$/i);
  let body = m ? m[1].trim() : '';
  if (!body) { skipped.push(pc + '(头解析失败)'); continue; }
  let tail = '';
  const om = body.match(/(?<!\()\s*?(ORDER\s+BY[\s\S]+)$/i);
  if (om) { tail = ' ' + om[1].trim().replace(/;$/, '').replace(/(h|l|s|t|d)\.\[/g, '['); body = body.slice(0, om.index).trim(); }
  const adds = cols.map(c => `NULL AS [${c}]`).join(', ');
  let nd;
  if (/UNION/i.test(body)) {
    nd = `CREATE OR ALTER VIEW ${v} AS SELECT t.*, ${adds} FROM (${body}) t${tail}`;
  } else {
    const fi = body.search(/\sFROM\s/i);
    if (fi < 0) { skipped.push(pc + '(无FROM)'); continue; }
    nd = `CREATE OR ALTER VIEW ${v} AS ${body.slice(0, fi)}, ${adds}${body.slice(fi)}${tail}`;
  }
  sql += `\n-- ${pc} → ${v} (补: ${cols.join('/')}; 源: ${got.src})\nEXEC(N'${nd.replace(/'/g, "''")}');\n`;
  fixed++;
  console.log(`✓ ${v} ← ${got.src}`);
}
sql += `\n-- ERPLG_ROW → erp_imp_row(实体表):补 asp_cancel\nIF OBJECT_ID('erp_imp_row') IS NOT NULL AND COL_LENGTH('erp_imp_row','asp_cancel') IS NULL ALTER TABLE erp_imp_row ADD [asp_cancel] char(1) NULL DEFAULT 'N';\nGO\n\nPRINT N'migrate-align-views-20260924 完成(${fixed}+ERPLG)';\n`;
fs.writeFileSync('tools/migrate-align-views-20260924.sql', sql, 'utf8');
console.log(`生成: ${fixed}` + (skipped.length ? ' | 跳过: ' + skipped.join(', ') : ''));
