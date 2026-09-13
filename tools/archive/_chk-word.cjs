const fs = require('fs')
const s = fs.readFileSync('C:/INCER/YINJIA-MES/frontend/src/i18n/locales/en.js', 'utf8')
for (const w of ['选择', '暂无数据']) {
  const m = s.match(new RegExp("'" + w + "': '[^']*'"))
  console.log(w + ': ' + (m ? 'EXISTS ' + m[0] : 'MISSING'))
}
