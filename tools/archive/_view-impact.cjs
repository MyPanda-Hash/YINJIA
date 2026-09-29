#!/usr/bin/env node
/**
 * 「被删表牵连的视图」精确核查(任务产物)。
 * 输入:archive\_table-audit\{viewdefs.tsv(视图定义原文), drop-tables.txt(已删表)}
 * 口径:视图定义里以**词边界**出现已删表名(不区分大小写,兼容 [名字] 写法),
 *       避免 T-SQL LIKE '%dm_wz%' 把 dm_wzbacord 这类前缀误配进来。
 * 用法(在 tools 目录下):node archive\_view-impact.cjs
 */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '_table-audit');
const defs = fs.readFileSync(path.join(DIR, 'viewdefs.tsv'), 'utf8').split(/\r?\n/).filter(Boolean)
  .map(l => { const i = l.indexOf('\t'); return { name: l.slice(0, i), def: l.slice(i + 1) }; });
const dropped = fs.readFileSync(path.join(DIR, 'drop-tables.txt'), 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);

const hit = [];
for (const v of defs) {
  const matched = dropped.filter(t => new RegExp('(^|[^0-9A-Za-z_\\u4e00-\\u9fa5])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^0-9A-Za-z_\\u4e00-\\u9fa5]|$)', 'i').test(v.def));
  if (matched.length) hit.push({ view: v.name, tables: matched });
}
console.log(`视图总数 ${defs.length};定义里引用到已删表的视图: ${hit.length} 个`);
for (const h of hit) console.log(`  ${h.view}  <-  ${h.tables.join(', ')}`);
const tables = new Set(hit.flatMap(h => h.tables));
console.log(`\n牵连到的已删表: ${tables.size} 张 -> ${[...tables].sort().join(', ')}`);
