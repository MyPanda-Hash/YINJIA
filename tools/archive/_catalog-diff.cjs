#!/usr/bin/env node
// 对账:docs/development/数据库表清单.md 登记的对象 vs 审计导出的 objects.csv(只读;任务产物)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

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

const doc = fs.readFileSync(path.join(ROOT, 'docs/development/数据库表清单.md'), 'utf8');
const names = [...doc.matchAll(/^\| `([^`]+)` \|/gm)].map(m => m[1]).filter(n => !['yj_', 'bs_', 'rd_', 'qc_', 'wo_'].includes(n));
const rows = parseCsv(path.join(ROOT, 'tools/archive/_table-audit/objects.csv'));
const tbl = new Set(rows.filter(r => r.kind === 'TABLE').map(r => r.name));
const vw = new Set(rows.filter(r => r.kind === 'VIEW').map(r => r.name));
console.log(`清单登记 ${names.length} 项;审计 CSV 表 ${tbl.size} / 视图 ${vw.size}`);
const miss = names.filter(n => !tbl.has(n) && !vw.has(n));
console.log(`清单有、CSV 无 (${miss.length}): ${miss.join(', ')}`);
const extra = [...tbl, ...vw].filter(n => !names.includes(n));
console.log(`CSV 有、清单无 (${extra.length}): ${extra.join(', ')}`);
