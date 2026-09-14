/* 从 db/HSDZ_MES.sql 提取核心表 DDL 到 schemas/core-tables.sql */
const fs = require('fs')
const src = fs.readFileSync('C:/INCER/YINJIA-MES/db/HSDZ_MES.sql', 'utf8')
const TARGET = ['yj_panel', 'yj_field', 'yj_translation', 'yj_locale', 'yj_doc_status',
  'yj_form_approval', 'yj_role_panel', 'yj_user', 'yj_usage_log', 'form_flow_link',
  'bs_dept', 'bs_inv', 'bd_so_order', 'bl_so_order']
const out = ['-- 核心表结构(摘自 YINJIA-MES db/HSDZ_MES.sql;light-mes 对应见注释)']
for (const t of TARGET) {
  const re = new RegExp('(IF OBJECT_ID\\(\'dbo\\.' + t + '\'.*?CREATE TABLE dbo\\.\\[' + t + '\\] \\([\\s\\S]*?\\n\\);)', 'm')
  const m = src.match(re)
  if (m) out.push('\n-- ===== ' + t + ' =====\n' + m[1])
  else out.push('\n-- ' + t + ': (not in dump)')
}
fs.writeFileSync('C:/INCER/CHENGXIAO/schemas/core-tables.sql', out.join('\n'), 'utf8')
console.log('written', out.length, 'blocks')
