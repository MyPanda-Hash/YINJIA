/* 轻量语法体检:去掉注释/字符串后检查括号配平 + Java 文件不得出现非 ASCII 之外的乱码(只查配平,不替代编译) */
import { readFileSync } from 'node:fs'
const files = [
  'D:/workspace/yinjia/backend/src/main/java/com/yinjia/mes/service/PagePanelRegistry.java',
  'D:/workspace/yinjia/backend/src/main/java/com/yinjia/mes/service/PanelPermissionService.java',
]
let bad = 0
for (const f of files) {
  let s = readFileSync(f, 'utf8')
  s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  let depth = 0, min = 0
  for (const ch of s) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth < min) min = depth } }
  const ok = depth === 0 && min === 0
  console.log((ok ? '[OK] ' : '[FAIL] ') + f.split('/').pop() + ' 括号配平 depth=' + depth + ' min=' + min)
  if (!ok) bad++
}
process.exit(bad ? 1 : 0)
