const fs=require('fs')
const t=fs.readFileSync(String.raw`D:\workspace\yinjia\tools\migrate-whloc.sql`,'utf8')
const lines=t.split(/\r?\n/)
// 找 yj_translation 的 INSERT 段
const out=[]
let inBlock=false
for (let i=0;i<lines.length;i++){
  const L=lines[i]
  if (/yj_translation/i.test(L)) inBlock=true
  if (inBlock) out.push((i+1)+': '+L)
  if (inBlock && /;\s*$/.test(L) && /VALUES|INSERT/i.test(out.slice(-40).join('\n'))) { /* keep going a bit */ }
}
console.log(out.slice(0,120).join('\n'))