// patch e2e probe: last DATA row (has editable cells), not placeholder
const fs = require('fs')
const p = 'tools/archive/_whloc-e2e.cjs'
let t = fs.readFileSync(p, 'utf8')
const OLD1 = "var trs=[].slice.call(document.querySelectorAll('.el-table__row')); var tr=trs[trs.length-1];"
const OLD2 = "var trs=[].slice.call(document.querySelectorAll('.el-table__row'));var tr=trs[trs.length-1];"
const OLD3 = "var trs=[].slice.call(document.querySelectorAll('.el-table__row'));var tr=trs[trs.length-1];var ths"
const NEW1 = "var trs=[].slice.call(document.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, td input')}); var tr=trs[trs.length-1];"
const NEW2 = "var trs=[].slice.call(document.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, td input')});var tr=trs[trs.length-1];"
const NEW3 = "var trs=[].slice.call(document.querySelectorAll('.el-table__row')).filter(function(r){return r.querySelector('.cell-lazy, td input')});var tr=trs[trs.length-1];var ths"
let n = 0
while (t.includes(OLD1)) { t = t.replace(OLD1, NEW1); n++ }
while (t.includes(OLD2)) { t = t.replace(OLD2, NEW2); n++ }
while (t.includes(OLD3)) { t = t.replace(OLD3, NEW3); n++ }
fs.writeFileSync(p, t)
console.log('patched occurrences:', n)
