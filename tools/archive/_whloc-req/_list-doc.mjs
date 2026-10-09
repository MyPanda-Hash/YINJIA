import fs from 'node:fs'
for (const rel of ['docs/development/数据库表清单.md','docs/development/库存表清单.md','docs/development/仓库仓位四层结构与编码规则.md']) {
  const lines = fs.readFileSync('D:/workspace/yinjia/'+rel,'utf8').split(/\r?\n/)
  console.log(`\n########## ${rel} ##########`)
  lines.forEach((L,i)=>{ if(L.includes('仓位')) console.log(`  ${String(i+1).padStart(5)}: ${L.trim().slice(0,150)}`) })
}