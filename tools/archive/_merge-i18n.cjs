/* 合并冲突语言包:HEAD(ours/:2:)与本地提交(theirs/:3:)词条并集,ours 优先 */
const fs = require('fs')
const vm = require('vm')
const { execSync } = require('child_process')
const dir = 'C:/INCER/YINJIA-MES/frontend/src/i18n/locales/'
const LANG = ['en', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']

function parse(src) {
  try { return vm.runInNewContext('(function(){' + src.replace('export default', 'return') + '})()') } catch (e) { return null }
}
function merge(a, b) {
  const out = {}
  for (const k of Object.keys(a)) out[k] = a[k]
  for (const k of Object.keys(b)) {
    if (!(k in out)) { out[k] = b[k]; continue }
    if (typeof out[k] === 'object' && out[k] && typeof b[k] === 'object' && b[k]) {
      const merged = {}
      for (const kk of Object.keys(b[k])) merged[kk] = b[k][kk]
      for (const kk of Object.keys(out[k])) merged[kk] = out[k][kk]
      out[k] = merged
    }
  }
  return out
}
function key(k) { return /^[A-Za-z0-9_-]+$/.test(k) ? k : `'${k}'` }
function ser(obj, ind) {
  const pad = '  '.repeat(ind)
  const lines = []
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v && typeof v === 'object') {
      lines.push(`${pad}${key(k)}: {`)
      lines.push(ser(v, ind + 1))
      lines.push(`${pad}},`)
    } else {
      lines.push(`${pad}${key(k)}: '${String(v ?? '').replace(/'/g, "\\'")}',`)
    }
  }
  return lines.join('\n')
}

for (const lang of LANG) {
  const file = dir + lang + '.js'
  const ours = execSync(`git -C C:/INCER/YINJIA-MES show :2:frontend/src/i18n/locales/${lang}.js`, { encoding: 'utf8' })
  const theirs = execSync(`git -C C:/INCER/YINJIA-MES show :3:frontend/src/i18n/locales/${lang}.js`, { encoding: 'utf8' })
  const o = parse(ours), t = parse(theirs)
  if (!o || !t) { console.log(lang + ': parse fail'); continue }
  const merged = merge(o, t)
  const out = '/** 自动合并(ours+theirs 词条并集) */\nexport default {\n' + ser(merged, 1) + '\n}\n'
  fs.writeFileSync(file, out, 'utf8')
  console.log(lang + ': merged, biz=' + Object.keys(merged.biz || {}).length)
}
