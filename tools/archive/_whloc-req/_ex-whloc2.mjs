// 抽 tools/migrate-wh-location.sql 里「库位」相关段(bs_wh.库位 的字段与译名)
import fs from 'node:fs'
const t = fs.readFileSync('D:/workspace/yinjia/tools/migrate-wh-location.sql', 'utf8')
console.log(t.split(/\r?\n/).map((L, i) => String(i + 1).padStart(4) + ': ' + L).join('\n'))
