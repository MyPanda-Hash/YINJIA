#!/usr/bin/env node
/* 从 setup-db.sql 的 yj_field 定义生成遗留表(dm_kh/dm_gf/dm_ywy/dm_ck/inh/outh/Porder/
   order_bs/order_bt/mate/kucun)的幂等 CREATE TABLE,追加进 legacy-hsdz-compat.sql。
   用法: node gen-legacy-compat.cjs  (在 tools 目录运行) */
const fs = require('fs');
const path = require('path');

const SQL = fs.readFileSync(path.join(__dirname, 'setup-db.sql'), 'utf8');

// 面板 -> 数据表(mode doc: line_table 为行表;archive/flat: line_table 为唯一表)
const PANEL_TABLE = {
  KHDA: ['dm_kh'], GFDA: ['dm_gf'], YWYDA: ['dm_ywy'], CKDA: ['dm_ck'],
  ZDGL: ['dm_gx'],
  RKD: ['inh'], CKD: ['outh'], CGD: ['Porder'],
  KHDD: ['order_bs', 'order_bt'],
  WLBOM: ['mate'], STOCK_STATUS: ['kucun'],
};

const TYPE_MAP = {
  '文本': 'nvarchar(200)',
  '小数': 'decimal(18,4)',
  '日期': 'datetime',
  '整数': 'int',
  '下拉框': 'nvarchar(50)',
  '参照': 'nvarchar(50)',
  '多行文本': 'nvarchar(max)',
};

// 抓取 yj_field 插入行:('PANEL','col',N'label','类型',...) — label 与类型之间可能有 dict_sql
const rowRe = /\('(KHDA|GFDA|YWYDA|CKDA|ZDGL|RKD|CKD|CGD|KHDD|WLBOM|STOCK_STATUS)'\s*,\s*'([a-z_0-9]+)'\s*,\s*N?'[^']*'\s*,\s*N?(?:'[^']*'\s*,\s*)?N?'(文本|小数|日期|整数|下拉框|参照|多行文本)'/g;

const cols = {}; // table -> [{name, type}] (保持定义顺序,去重)
for (const m of SQL.matchAll(rowRe)) {
  const tables = PANEL_TABLE[m[1]];
  const sqlType = TYPE_MAP[m[3]];
  if (!sqlType) throw new Error('未知类型: ' + m[3]);
  for (const t of tables) {
    cols[t] = cols[t] || [];
    if (!cols[t].some(c => c.name === m[2])) cols[t].push({ name: m[2], type: sqlType });
  }
}

const blocks = [];
for (const [table, list] of Object.entries(cols)) {
  const defs = list.map(c => `    [${c.name}] ${c.type} NULL`);
  blocks.push(`IF OBJECT_ID('dbo.${table}') IS NULL\nCREATE TABLE dbo.${table} (\n    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,\n${defs.join(',\n')},\n    asp_cancel char(1) NOT NULL CONSTRAINT df_${table}_cancel DEFAULT ('N'),\n    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,\n    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL\n);`);
}

const header = `\n-- ======== 以下由 gen-legacy-compat.cjs 从 setup-db.sql yj_field 定义生成(勿手工改) ========\nGO\n`;
const body = blocks.join('\nGO\n') + '\nGO\n';

// 合并进 legacy-hsdz-compat.sql:去掉旧的生成段,替换为新段
const FILE = path.join(__dirname, 'legacy-hsdz-compat.sql');
let content = fs.readFileSync(FILE, 'utf8');
const MARK = '-- ======== 以下由 gen-legacy-compat.cjs';
const cut = content.indexOf(MARK);
if (cut >= 0) content = content.slice(0, cut).replace(/\s+$/, '\n');
fs.writeFileSync(FILE, content + header + body, 'utf8');

console.log('生成表:', Object.keys(cols).join(', '));
for (const [t, l] of Object.entries(cols)) console.log(`  ${t}: ${l.length} 列`);
