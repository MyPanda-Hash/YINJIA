const r = await fetch('http://localhost:5173/src/core/views/PanelxList.vue')
const t = await r.text()
console.log('模块大小:', t.length)
for (const k of ['onInlineSelectBlur','onInlineBoolInput','onInlineDetailChange']) {
  const n = (t.match(new RegExp(k,'g'))||[]).length
  console.log(`  ${k}: 出现 ${n} 次`)
}
const i = t.indexOf('onInlineSelectBlur')
if (i>=0) console.log('\n片段:', JSON.stringify(t.slice(Math.max(0,i-120), i+260)))