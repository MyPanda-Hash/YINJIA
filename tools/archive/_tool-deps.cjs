#!/usr/bin/env node
/**
 * 工具链依赖核查(只读;任务产物)。
 * 判定用的「业务代码」只含 backend/src/main/java 与 frontend/src;但 tools/ 下的正式工具
 * (DbSync/DbInit/DbSchemaDiff/DbNormAudit/verify 脚本)也会依赖某些表 —— 若把这类表删掉,
 * 工具会崩或重跑整条迁移链。本探针把「待删表 × tools 引用」列出来人工过一遍。
 *
 * 用法(在 tools 目录下):node archive\_tool-deps.cjs
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '_table-audit');
const ROOT = path.resolve(__dirname, '..', '..');
const drop = new Set(fs.readFileSync(path.join(DIR, 'drop-tables.txt'), 'utf8').split(/\r?\n/).filter(Boolean));

/** tools 下的正式工具(排除迁移 SQL/生成器数据/本探针所在 archive) */
function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'archive', 'lib'].includes(e.name)) walk(p, acc); }
    else if (/\.(java|cjs|mjs|ps1|bat)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const files = walk(path.join(ROOT, 'tools'), []);
const hits = new Map();
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const txt = fs.readFileSync(f, 'utf8');
  for (const t of drop) {
    if (new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(txt)) {
      if (!hits.has(t)) hits.set(t, new Set());
      hits.get(t).add(rel);
    }
  }
}
console.log(`工具文件 ${files.length} 个;待删表中被 tools 正式工具引用的: ${hits.size} 张`);
for (const [t, fs_] of [...hits].sort()) console.log(`  ${t} <- ${[...fs_].join(' , ')}`);
