#!/usr/bin/env node
/**
 * 生成 tools/db-inuse-tables.txt —— 「确定下来的后台表」在册登记(任务产物)。
 * 输入:archive\_table-audit\{classify.csv,objects.csv}
 * 口径:在用 A/B 组 = 在册表;C/D/E/F 组已物理删除;例外保留(yj_schema_log/erp_imp_row/dm_key)单列。
 * 用法(在 tools 目录下):node archive\_gen-inuse-tables.cjs
 */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '_table-audit');
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

const cls = parseCsv(path.join(DIR, 'classify.csv'));
const objs = new Map(parseCsv(path.join(DIR, 'objects.csv')).map(o => [o.name, o]));
const inuse = cls.filter(r => /^[AB]_/.test(r.class));
const engine = inuse.filter(r => /^yj_/.test(r.table)).sort((a, b) => a.table.localeCompare(b.table));
const mesOwn = inuse.filter(r => r.class[0] === 'A' && !/^yj_/.test(r.table)).sort((a, b) => a.table.localeCompare(b.table));
const legacy = inuse.filter(r => r.class[0] === 'B').sort((a, b) => a.table.localeCompare(b.table));
const kept = ['yj_schema_log', 'erp_imp_row', 'dm_key'];

const line = (t) => {
  const o = objs.get(t) || {};
  const zh = (o.ms_description || '').replace(/\s+/g, ' ').trim();
  return `table:${t}${zh ? '   # ' + zh : ''}`;
};

const L = [];
L.push('# tools/db-inuse-tables.txt — 「确定下来的后台表」在册登记');
L.push('#');
L.push('# 依据:2026-09-29 四源审计(①) yj_panel 面板绑定且面板在运营 ② 在运营视图依赖 ③ backend/src/main/java');
L.push('#   + frontend/src 运行期 SQL 引用 ④ 业务数据行)。判定口径与逐表证据:tools/archive/_table-audit/');
L.push('#   (objects/panels/deps/refs/granted/classify/drop-risk/drop-plan)。');
L.push('# 读取方:人工排查 + docs/development/数据库表清单.md §0.1。');
L.push('# 用法:① 判断一张表「是不是我们自己的」→ 在册即自有/在用,不在册即脏数据;');
L.push('#   ② 新建表必须先在本文件登记(连同 db-migrations.txt 迁移脚本 + MS_Description);');
L.push('#   ③ 本文件之外的业务表出现,按未用表清理流程处理(见 migrate-drop-unused-tables.sql 头部)。');
L.push('# 例外保留(未用但不删,逐条有据):yj_schema_log=DbSync 迁移登记表;erp_imp_row=ERP 导入通道;');
L.push('#   dm_key=含明文接口密钥的历史资产(单独处置)。系统自带 dtproperties(is_ms_shipped=1)不在登记范围。');
L.push('# 格式:table:<表名>   # 中文说明');
L.push('');
L.push(`# ---- 引擎元数据与运行时(yj_*,${engine.length} 张;结构由代码与迁移脚本固定,不加自定义字段备用列) ----`);
for (const r of engine) L.push(line(r.table));
L.push('');
L.push(`# ---- MES 自有业务表(${mesOwn.length} 张;bs_/bd_/bl_/rd_/qc_/wo_ + day_report 等本系统自建表) ----`);
for (const r of mesOwn) L.push(line(r.table));
L.push('');
L.push(`# ---- 经典 HSDZ 遗留但仍在用(${legacy.length} 张;改动前须评估面板影响,新功能禁止再用) ----`);
for (const r of legacy) L.push(line(r.table));
L.push('');
L.push(`# ---- 例外保留(${kept.length} 张;未用但按上列理由不删) ----`);
for (const t of kept) L.push(line(t));
L.push('');
L.push(`# 合计 ${inuse.length} 张在册 + ${kept.length} 张例外保留 = ${inuse.length + kept.length} 张;`);
L.push('# 已清理 244 张(RENAME_*/_bak_*/tmp_*/t1/t2 + pr_* 已下架面板表 + 无引用遗留表),清单见');
L.push('# tools/migrate-drop-unused-tables.sql 与 tools/archive/_table-audit/drop-tables.txt。');
L.push('');

const out = path.join(ROOT, 'tools', 'db-inuse-tables.txt');
fs.writeFileSync(out, L.join('\n'), 'utf8');
console.log(`[done] ${out}`);
console.log(`  引擎 ${engine.length} / MES 自有 ${mesOwn.length} / 遗留在用 ${legacy.length} / 例外保留 ${kept.length}`);
