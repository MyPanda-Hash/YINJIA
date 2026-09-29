#!/usr/bin/env node
/**
 * 生成「待删表 + 连带悬空面板」清单(只读;任务产物)。
 * 输入:archive\_table-audit\{classify.csv,panels.csv}
 * 输出:archive\_table-audit\drop-plan.txt(人读) 与 drop-tables.txt / drop-panels.txt(机读)
 *
 * 规则(2026-09-29 用户批准):
 *   - 删:C/D/E/F 组 + X 组;
 *   - 例外保留:erp_imp_row(ERP 导入通道可能由外部程序写入)、dm_key(含明文密钥的历史资产,单独处置);
 *   - 连带清理:被绑定的表**全部**落在待删集合里的面板(yj_panel/yj_field/yj_role_panel 行 + 只在
 *     该面板使用的中文标签译名词条)。
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

// 例外保留(逐条有据,勿改成谓词):
//   yj_schema_log —— tools/DbSync.java 的迁移登记表;删了整条链按「未执行」全量重跑(实测依赖)
//   erp_imp_row  —— 与在用面板 ERPLG 同属 ERP 导入通道,本仓库无导入代码,可能由外部程序写入(0 行,留着零成本)
//   dm_key       —— 含明文接口密钥,属「要脱敏的历史资产」,单独处置,不在本脚本范围
const KEEP_EXCEPTIONS = new Set(['yj_schema_log', 'erp_imp_row', 'dm_key']);
const cls = parseCsv(path.join(DIR, 'classify.csv'));
const panels = parseCsv(path.join(DIR, 'panels.csv'));

const drop = cls.filter(r => /^[CDEFX]_/.test(r.class) && !KEEP_EXCEPTIONS.has(r.table)).map(r => r.table).sort();
const dropSet = new Set(drop);
const kept = cls.filter(r => !dropSet.has(r.table));
const keptSet = new Set(kept.map(r => r.table));

// 连带面板:所有绑定对象(头/行表)都在待删集合内
const dropPanels = [];
for (const p of panels) {
  const ts = [p.head_table, p.line_table].map(s => (s || '').trim()).filter(Boolean);
  if (!ts.length) continue;
  if (ts.every(t => dropSet.has(t))) dropPanels.push({ code: p.panel_code, name: p.panel_name, mode: p.mode, tables: ts.join('+') });
}
dropPanels.sort((a, b) => a.code.localeCompare(b.code));

const L = [];
L.push(`== 待删表 ${drop.length} 张 ==`);
const groups = {};
for (const r of cls.filter(x => dropSet.has(x.table))) (groups[r.class] = groups[r.class] || []).push(r.table);
for (const [g, ts] of Object.entries(groups).sort()) {
  L.push(`-- ${g} (${ts.length}):`);
  L.push('   ' + ts.sort().join(' '));
}
L.push('');
L.push(`== 连带清理面板 ${dropPanels.length} 个 ==`);
for (const p of dropPanels) L.push(`   ${p.code}\t${p.name}\t[${p.mode}]\t${p.tables}`);
L.push('');
L.push(`== 例外保留 ${[...KEEP_EXCEPTIONS].join(', ')} ==`);
L.push('');
L.push(`== 保留对象合计 ${kept.length} 张表(其中视图 ${kept.filter(r => r.class === '').length}) ==`);

fs.writeFileSync(path.join(DIR, 'drop-plan.txt'), L.join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(DIR, 'drop-tables.txt'), drop.join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(DIR, 'drop-panels.txt'), dropPanels.map(p => p.code).join('\n') + '\n', 'utf8');

// ---- 备用列目标:在用业务表(排除 yj_ 引擎元数据表)里尚缺 20 个备用列的
const spareTargets = cls.filter(r => /^[AB]_/.test(r.class) && !/^yj_/.test(r.table) && Number(r.spare) !== 20)
  .map(r => r.table).sort();
const conflict = spareTargets.filter(t => dropSet.has(t));
fs.writeFileSync(path.join(DIR, 'spare-targets.txt'), spareTargets.join('\n') + '\n', 'utf8');
console.log('');
console.log(`== 备用列目标(在用业务表缺列者)${spareTargets.length} 张 ==`);
console.log('   ' + spareTargets.join(' '));
if (conflict.length) console.log(`   [冲突] 同时出现在待删集合: ${conflict.join(' ')}`);
console.log(L.join('\n'));
