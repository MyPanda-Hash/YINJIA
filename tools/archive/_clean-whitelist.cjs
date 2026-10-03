#!/usr/bin/env node
/**
 * 白名单清理(任务产物):删掉指向已不存在的表/面板的 table:/col:/dupkey: 登记,
 * 并把 count:10 棘轮基线收到 0(备份/临时表已清零,今后再出现即 FAIL)。
 * 不动行尾空格(白名单里有带尾空格的列名,如 col:bd_sale_out.ivc_status / skiplabel:ivc_status)。
 *
 * 用法(在 tools 目录下):
 *   node archive\_clean-whitelist.cjs <objects.csv|表名清单txt> [drop-tables.txt] [--write]
 *   (objects.csv 由 archive\_TableAudit.java 从实库导出,取其中 kind=TABLE 的名字)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const wlPath = path.join(ROOT, 'tools', 'db-legacy-whitelist.txt');
const existFile = process.argv[2];
const droppedFile = process.argv[3] || path.join(__dirname, '_table-audit', 'drop-tables.txt');
const write = process.argv.includes('--write');

const readList = (f) => fs.readFileSync(f, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const existing = new Set(
  existFile.toLowerCase().endsWith('.csv')
    ? readList(existFile).slice(1)
        .map(l => { const m = l.match(/^"((?:[^"]|"")*)",([A-Z]+),/); return m && m[2] === 'TABLE' ? m[1].replace(/""/g, '"') : null; })
        .filter(Boolean)
    : readList(existFile));
const dropped = new Set(readList(droppedFile));
const droppedPanels = new Set(readList(path.join(__dirname, '_table-audit', 'drop-panels.txt')));
const existingPanels = new Set(readList(path.join(__dirname, '_table-audit', 'panels.csv'))
  .slice(1).map(l => { const m = l.match(/^"((?:[^"]|"")*)"/); return m ? m[1] : ''; }).filter(Boolean));

const raw = fs.readFileSync(wlPath, 'utf8');
const lines = raw.split(/\r?\n/);
const kept = [], removed = { table: 0, col: 0, dupkey: 0, panel: 0 };
let ratchetChanged = 0;

/** 取登记项归属的表名:表名不含 '.'(规范硬约束),所以按第一个 '.' 切 */
function tableOf(v) { const i = v.indexOf('.'); return i < 0 ? v : v.slice(0, i); }

for (const line of lines) {
  if (line.startsWith('#')) { kept.push(line); continue; }
  if (line.startsWith('count:10=')) {
    kept.push('count:10=0'); ratchetChanged++; continue;
  }
  const m = line.match(/^(table|panel|col|dupkey):(.*)$/);
  if (!m) { kept.push(line); continue; }
  const kind = m[1];
  // 逐字保留值(含尾空格);'|' 结尾是生成器保护尾空格的写法,入库前已剥
  const v = m[2].endsWith('|') ? m[2].slice(0, -1) : m[2];
  if (kind === 'table') {
    // 只删「本任务确实删掉」的表;其余一律保留(含 dtproperties 这类 is_ms_shipped=1、
    // 不在审计导出里的系统自带表 —— 首版按「现有表清单」判定时误删过它,体检立刻 01/02/03 FAIL)
    if (dropped.has(v)) { removed.table++; } else { kept.push(line); }
  } else if (kind === 'panel') {
    if (droppedPanels.has(v)) { removed.panel++; } else { kept.push(line); }
  } else if (kind === 'col') {
    if (dropped.has(tableOf(v))) { removed.col++; } else { kept.push(line); }
  } else if (kind === 'dupkey') {
    if (droppedPanels.has(tableOf(v))) { removed.dupkey++; } else { kept.push(line); }
  }
}
const out = kept.join('\r\n');
console.log(`白名单 ${lines.length} 行 -> ${kept.length} 行; 删登记 table ${removed.table} / col ${removed.col} / dupkey ${removed.dupkey} / panel ${removed.panel}; count:10 改 ${ratchetChanged} 处`);
if (write) { fs.writeFileSync(wlPath, out, 'utf8'); console.log('[write] 已写回 tools/db-legacy-whitelist.txt'); }
else console.log('(dry-run;加 --write 才写回)');
