/* 生成 zh-TW.js:基础词条从 zh-CN.js 转繁体(仅值),biz 词典从 en.js 提取键、值=键转繁体 */
const fs = require('fs')
const vm = require('vm')
const OpenCC = require('opencc-js')

const s2twp = OpenCC.Converter({ from: 'cn', to: 'twp' })
const dir = 'C:/INCER/YINJIA-MES/frontend/src/i18n/locales/'

// 1) 基础词条(zh-CN.js):逐行只转值(键可能带引号或裸标识符)
const zhcn = fs.readFileSync(dir + 'zh-CN.js', 'utf8')
let out = zhcn.split('\n').map((line) => {
  const m = line.match(/^(\s*(?:'[^']+'|[A-Za-z]\w*):\s*)'(.*)'\s*,?\s*$/)
  if (m) {
    let val = m[2].replace(/\\'/g, "'")
    val = s2twp(val)
    val = val.replace(/'/g, "\\'")
    return m[1] + "'" + val + "',"
  }
  return line
}).join('\n')

// 语言名对象:加 zh-TW 项(此时 zh-CN 值已被转成繁体)
out = out.replace("    'zh-CN': '簡體中文',", "    'zh-CN': '簡體中文',\n    'zh-TW': '繁體中文',")

// 2) biz 词典:vm 求值 en.js 对象,提取全部中文键
const enSrc = fs.readFileSync(dir + 'en.js', 'utf8').replace('export default', 'return')
const enObj = vm.runInNewContext('(function() {' + enSrc + '})()')
const keys = Object.keys(enObj.biz || {}).filter((k) => /[\u4e00-\u9fff]/.test(k))
const bizOut = keys.map((k) => "    '" + k + "': '" + s2twp(k).replace(/'/g, "\\'") + "',").join('\n')

// 3) biz 插入 export default 的闭合 } 前(最后一个 '\n}')
const idx = out.lastIndexOf('\n}')
out = out.slice(0, idx) + '\n  biz: {\n' + bizOut + '\n  },\n}' + out.slice(idx + 2)
fs.writeFileSync(dir + 'zh-TW.js', out, 'utf8')
console.log('zh-TW.js written; biz keys =', keys.length, '; file bytes =', Buffer.byteLength(out, 'utf8'))
