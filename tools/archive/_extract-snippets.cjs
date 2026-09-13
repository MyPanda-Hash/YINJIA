/* 提取 ButtonService 状态机+审批段;light-mes 列偏好 DDL 追加 schemas */
const fs = require('fs')
// 1) 状态机段
const bs = fs.readFileSync('C:/INCER/YINJIA-MES/backend/src/main/java/com/yinjia/mes/service/ButtonService.java', 'utf8')
const start = bs.indexOf('// ============ 状态机')
const end = bs.indexOf('    /** 中止(对齐')
const seg = bs.slice(start, end < 0 ? bs.length : end)
fs.writeFileSync('C:/INCER/CHENGXIAO/snippets/backend/doc-status-flow.java', seg, 'utf8')
console.log('state machine segment bytes=', seg.length)
// 2) light-mes 列偏好 DDL
const src = fs.readFileSync('C:/INCER/light-mes/tools/update-2026-09-01-c-column-prefs.sql', 'utf8')
fs.appendFileSync('C:/INCER/CHENGXIAO/schemas/core-tables.sql', '\n\n-- ===== px_column_pref (light-mes 用户级列偏好) =====\n' + src, 'utf8')
console.log('px_column_pref ddl appended')
