// _aspmis-probe/_extract-menu.cjs — 从抓取的 admin.html 提取菜单清单(纯本地,无网络)
const fs = require('node:fs')
const path = require('node:path')
const html = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8')
function dec(s) {
  return s.replace(/&#x([0-9a-fA-F]+);?/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
const aside = html.match(/<aside[\s\S]*?<\/aside>/)[0]
const modules = aside.split('<div id="platform"').slice(1)
const out = []
let total = 0
modules.forEach((mod, mi) => {
  const dt = mod.match(/<dt[^>]*>([\s\S]*?)<\/dt>/)
  const modName = dec((dt ? dt[1] : '?').replace(/<[^>]+>/g, '')).trim()
  out.push('### 模块 ' + (mi + 1) + '：' + modName, '', '| 分组 | 菜单 | data-href | data-title(原文,多为占位错文) |', '|---|---|---|---|')
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g
  let m
  while ((m = liRe.exec(mod))) {
    const inner = m[1]
    const a = inner.match(/<a[^>]*data-href="([^"]*)"[^>]*data-title="([^"]*)"[^>]*>([\s\S]*?)<\/a>/)
    if (a) {
      const name = dec(a[3].replace(/<[^>]+>/g, '')).trim()
      out.push('|  | ' + name + ' | `' + dec(a[1]) + '` | ' + dec(a[2]) + ' |')
      total++
    } else {
      const t = dec(inner.replace(/<[^>]+>/g, '')).trim()
      if (/^-{3,}/.test(t)) out.push('| **' + t.replace(/^-+|-+$/g, '').trim() + '** |  |  |  |')
    }
  }
  out.push('')
})
out.push('**合计菜单项: ' + total + '**')
fs.writeFileSync(path.join(__dirname, 'menu-inventory.md'), out.join('\n'))
console.log('saved menu-inventory.md, total:', total)
