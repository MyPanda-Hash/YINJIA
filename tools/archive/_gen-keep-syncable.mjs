// 生成器:按"可同步字段"裁剪面板 —— 保留 = mapArchive 实际能写出且接口真有的键;其余全删
// 输出:tools/migrate-kingdee-archive-keep-syncable.sql + 控制台对照清单
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOCS } from '../../deploy/sync-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const api = JSON.parse(readFileSync(join(HERE, '_archive-fields.json'), 'utf8'));
const panelCols = new Map();
for (const line of readFileSync(join(HERE, '_panel-fields.out'), 'utf8').split(/\r?\n/)) {
  const [p, c] = line.split('|');
  if (!p || !c || p === 'panel_code') continue;
  if (!panelCols.has(p)) panelCols.set(p, []);
  panelCols.get(p).push(c);
}
const PANEL = {
  BD_SETTLE: 'SETTLE', BD_CUSGRP: 'CUSGRP', BD_SUPGRP: 'SUPGRP', BD_MATGRP: 'MATGRP', BD_CUR: 'CUR',
  BD_UOM: 'UOM', BD_DEPT: 'DEPT', BD_EMP: 'EMP', BD_STORE: 'WH', BD_MATERIAL: 'INV', BD_CUSTOMER: 'KHDA', BD_SUPPLIER: 'GFDA',
};
// 键集 = 列表 ∪ 详情(与运行期一致)
const keysOf = (rec) => new Set([...(rec?.listKeys || []), ...(rec?.detailKeys || [])]);
const mergeSample = (rec) => {
  const out = { ...(rec?.listFull || {}) };
  for (const [k, v] of Object.entries(rec?.detailFull || {})) {
    const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty && k in out) continue;
    out[k] = v;
  }
  return out;
};

// 敏感密文字段:2026-09-15 起改为「解密导入」(kingdee-crypto.mjs),因此不再是不可同步 → 保留在面板
const UNSYNCABLE = {};

const sql = [];
sql.push('-- migrate-kingdee-archive-keep-syncable.sql — 档案面板只保留「金蝶接口可同步」的字段');
sql.push('-- 口径(用户确认 2026-09-15):面板列 = sync-core.mapArchive 实际能写出、且金蝶接口(列表∪详情)真有该键的字段;');
sql.push('--   其余一律删除(敏感密文字段当前策略不落库→删;金蝶接口无此键→删;纯 id 无名称孪生→不建)。');
sql.push('--   物理列保留(不 DROP),只删 yj_field 面板字段,可随时按需恢复。');
sql.push('-- 生成器:tools/archive/_gen-keep-syncable.mjs(与映射同源,防手工漂移)');
sql.push('USE HSDZ_MES;');
sql.push('SET NOCOUNT ON;');
sql.push('GO');
sql.push('');
let totalDel = 0;
const report = [];
for (const [code, panel] of Object.entries(PANEL)) {
  const rec = api[code];
  const doc = DOCS.find((d) => d.code === code);
  const full = mergeSample(rec);
  const ctx = { matgrpById: new Map(), matgrpNameById: new Map(), cusgrpById: new Map(), supgrpById: new Map() };
  if (doc.afterList) doc.afterList([full], ctx);
  const mapped = new Set(Object.keys(doc.mapArchive(full, ctx)).filter((k) => !k.startsWith('__')));
  for (const s of UNSYNCABLE[panel] || []) mapped.delete(s); // 敏感不落库 → 不算"可同步"
  const apiKeys = keysOf(rec);
  const current = panelCols.get(panel) || [];
  const keep = [], drop = [];
  for (const col of current) (mapped.has(col) ? keep : drop).push(col);
  report.push({ code, panel, keep: keep.length, drop: drop.length, dropList: drop, keepList: keep });
  totalDel += drop.length;
  sql.push(`-- ══ ${panel}(${code}):保留 ${keep.length} 删 ${drop.length} ══`);
  if (drop.length) {
    sql.push(`DELETE FROM yj_field WHERE panel_code='${panel}' AND col_name IN (${drop.map((c) => `N'${c}'`).join(', ')});`);
  } else {
    sql.push(`-- (无需删除)`);
  }
  sql.push('GO');
  sql.push('');
}
sql.push('-- ══ 自检:各面板剩余字段数 ══');
sql.push("SELECT panel_code, COUNT(*) AS 可同步字段数 FROM yj_field WHERE panel_code IN ('KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR') GROUP BY panel_code ORDER BY panel_code;");
sql.push("PRINT N'migrate-kingdee-archive-keep-syncable 完成(仅保留可同步字段)';");
sql.push('GO');
writeFileSync(join(HERE, '..', 'migrate-kingdee-archive-keep-syncable.sql'), sql.join('\n'), 'utf8');
console.log(`共删除 ${totalDel} 个不可同步字段`);
for (const r of report) {
  console.log(`\n【${r.panel}】保留 ${r.keep}: ${r.keepList.join(', ')}`);
  if (r.drop.length) console.log(`   ✂ 删除 ${r.drop.length}: ${r.dropList.join(', ')}`);
}
