#!/usr/bin/env node
/**
 * 表引用扫描探针 v2(只读;任务产物)。
 *
 * 与 v1 的区别:v1 只数「表名出现次数」,短名(如 zc/dh/address)会把同名变量/文档提及算进来。
 * v2 分三档计数:
 *   sql_refs   —— 出现在 SQL 语句位置(含 FROM/JOIN/INTO/UPDATE/ALTER/OBJECT_ID/EXEC 之后)
 *   panel_refs —— 出现在面板编码/元数据字符串里(yj_panel 行、跳转路径等)
 *   mentions   —— 其它出现(注释/文档/变量名等,弱证据)
 *
 * 用法(在 tools 目录下):node archive\_table-refs.cjs
 * 输出:archive\_table-audit\refs.csv
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(__dirname, '_table-audit');
const objCsv = path.join(DIR, 'objects.csv');
const outCsv = path.join(DIR, 'refs.csv');

const SCAN_DIRS = ['backend/src', 'frontend/src', 'tools', 'deploy', 'db'];
// 迁移链/部署 SQL 只作弱证据(建表≠在用),但与业务 SQL 分开计:sql_refs 只统计非迁移脚本
const SKIP_DIRS = new Set(['node_modules', '.git', 'archive', 'target', 'dist', 'lib', 'apache-maven-3.9.9', 'static']);
const EXTS = new Set(['.java', '.js', '.cjs', '.mjs', '.vue', '.sql', '.ps1', '.bat', '.yml', '.yaml', '.jrxml', '.py']);

function readObjects(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return txt.split(/\r?\n/).slice(1).filter(Boolean).map(l => {
    const m = l.match(/^"((?:[^"]|"")*)",([A-Z]+),/);
    return m ? { name: m[1].replace(/""/g, '"'), kind: m[2] } : null;
  }).filter(Boolean);
}

function walk(dir, acc) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, acc); }
    else if (EXTS.has(path.extname(e.name).toLowerCase())) acc.push(p);
  }
  return acc;
}

const objects = readObjects(objCsv).filter(o => o.kind === 'TABLE');
const files = [];
for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
const corpus = files.map(f => {
  let txt = '';
  try { txt = fs.readFileSync(f, 'utf8'); } catch { }
  return { rel: path.relative(ROOT, f).replace(/\\/g, '/'), txt };
});

const SQL_LEAD = '(?:from|join|into|update|table|exists|object_id\\s*\\(|dbo\\.|\\[dbo\\]|truncate\\s+table|alter\\s+table|drop\\s+table|count\\(\\*\\)\\s+from)';
const rows = [];
for (const o of objects) {
  const nm = o.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reSql = new RegExp(SQL_LEAD + "\\s*\\[?(?:dbo\\]?\\.)?\\[?" + nm + '\\]?\\b', 'gi');
  const reAny = new RegExp('\\b' + nm + '\\b', 'gi');
  let sqlRefs = 0, sqlRefsBiz = 0, mentions = 0, panelRefs = 0, samples = [];
  for (const f of corpus) {
    if (!f.txt) continue;
    // 「业务代码引用」只认运行期代码:后端 Java(排除 static 打包产物)与前端源码;
    // 其余(SQL 脚本/生成器/部署包/整库导出)只作弱证据——建表/清数据脚本引用 ≠ 在用。
    const isRuntime = /^backend\/src\/main\/java\//.test(f.rel) || /^frontend\/src\//.test(f.rel);
    const s = (f.txt.match(reSql) || []).length;
    const a = (f.txt.match(reAny) || []).length;
    if (s) { sqlRefs += s; if (isRuntime) sqlRefsBiz += s; }
    if (a) {
      mentions += a - s;
      if (new RegExp("['\"]" + nm + "['\"]", 'i').test(f.txt)) panelRefs += 1;
      if (samples.length < 3) samples.push(f.rel);
    }
  }
  rows.push({ name: o.name, sql_refs: sqlRefs, sql_refs_biz: sqlRefsBiz, panel_refs: panelRefs, mentions, samples: samples.join(' | ') });
}

const esc = s => '"' + String(s).replace(/"/g, '""') + '"';
fs.writeFileSync(outCsv, 'table,sql_refs,sql_refs_biz,panel_refs,mentions,sample_files\n'
  + rows.map(r => [esc(r.name), r.sql_refs, r.sql_refs_biz, r.panel_refs, r.mentions, esc(r.samples)].join(',')).join('\n') + '\n', 'utf8');
console.log(`[done] 扫描 ${corpus.length} 个文件, ${rows.length} 张表 -> ${outCsv}`);
console.log(`       有 SQL 真引用(全量脚本): ${rows.filter(r => r.sql_refs > 0).length}`);
console.log(`       有 SQL 真引用(非迁移脚本): ${rows.filter(r => r.sql_refs_biz > 0).length}`);
