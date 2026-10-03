// patch e2e probe v2: data row = 含可编辑单元格(.cell-lazy/.inline-ref-editor/td .el-input 等)的行
const fs = require('fs')
const p = 'tools/archive/_whloc-e2e.cjs'
let t = fs.readFileSync(p, 'utf8')
const OLD = ".filter(function(r){return r.querySelector('.cell-lazy, td input')})"
const NEW = ".filter(function(r){return r.querySelector('.cell-lazy, .inline-ref-editor, td .el-input, td .el-select, td .el-switch')})"
let n = 0
while (t.includes(OLD)) { t = t.replace(OLD, NEW); n++ }
fs.writeFileSync(p, t)
console.log('patched v2:', n)
