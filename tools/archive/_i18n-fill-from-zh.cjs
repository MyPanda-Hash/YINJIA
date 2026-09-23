/**
 * _i18n-fill-from-zh.cjs — 把代码里用到、语言包还没有的键,**按中文源文逐语言机翻**补齐
 *
 * 与 tools/gen/gen-locales-gap.cjs 的区别:那个是「以 en 为基准」补其它语种(en 自己缺的管不到),
 * 本脚本直接以**中文键**为源,对 10 个语言包各自补齐 —— 一跳翻译,不经过 en 中转,质量更好;
 * 而且能补 en 自身缺的存量词条。
 *
 * 为什么值得预烤:运行时 tt() 未命中也会走同一条 /api/locale/dict 机翻并缓存进 yj_translation,
 * 但那要求后端在线且配了 AK;预烤进静态包后,离线/无 AK 部署也能显示目标语言。
 * 机翻词条后续可由人工校对升级(与 yj_translation 的 source=mt → manual 同一口径)。
 *
 * 幂等:只补缺失键。用法:node tools/archive/_i18n-fill-from-zh.cjs [--dry]
 */
const fs = require('node:fs')
const path = require('node:path')

const DRY = process.argv.includes('--dry')
const ROOT = path.join(__dirname, '..', '..')
const SRC = path.join(ROOT, 'frontend', 'src')
const LOC = path.join(SRC, 'i18n', 'locales')
const BASE = 'http://localhost:8090'
const LOCALES = ['zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']
const CHUNK = 50
const SKIP = /[\\/](node_modules|dist|locales)[\\/]/

// ① 收集代码里静态可收集的 tt() 键
const used = new Set()
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (SKIP.test(p + path.sep)) continue
    if (e.isDirectory()) { walk(p); continue }
    if (!/\.(vue|js)$/.test(e.name) || /\.test\.js$/.test(e.name)) continue
    const src = fs.readFileSync(p, 'utf8')
    for (const m of src.matchAll(/\btt\(\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g)) if (m[1]) used.add(m[1].replace(/\\n/g, '\n').replace(/\\'/g, "'"))
  }
})(SRC)
console.log('代码里 tt() 键: ' + used.size)

// ② 逐语言补缺
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/'/g, "\\'")
const readKeys = (loc) => {
  const src = fs.readFileSync(path.join(LOC, loc + '.js'), 'utf8')
  return new Set([...src.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)].map((m) => m[1].replace(/\\n/g, '\n').replace(/\\'/g, "'")))
}

async function main() {
let grand = 0
for (const loc of LOCALES) {
  const have = readKeys(loc)
  const missing = [...used].filter((k) => !have.has(k) && !/\{\w+\}/.test(k))
  if (!missing.length) { console.log('  = ' + loc + ' 无缺口'); continue }
  console.log('  ' + loc + ' 缺 ' + missing.length + ' 条,机翻中...')
  const written = []
  for (let i = 0; i < missing.length; i += CHUNK) {
    const chunk = missing.slice(i, i + CHUNK)
    let dict = {}
    try {
      const res = await fetch(`${BASE}/api/locale/dict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ locale: loc, keys: chunk }),
      })
      const j = await res.json()
      dict = (j && j.data && j.data.dict) || {}
    } catch (e) {
      console.log('    批次失败: ' + e.message); continue
    }
    for (const k of chunk) {
      const v = dict[k]
      if (!v || !String(v).trim() || String(v) === k) continue
      written.push([k, String(v).trim()])
    }
    process.stdout.write(`\r    ${Math.min(i + CHUNK, missing.length)}/${missing.length} 已得 ${written.length}`)
  }
  console.log('')
  grand += written.length
  if (DRY || !written.length) continue
  const file = path.join(LOC, loc + '.js')
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const bizIdx = lines.findIndex((l) => /^\s*biz:\s*\{/.test(l))
  lines.splice(bizIdx + 1, 0, ...written.map(([k, v]) => "    '" + esc(k) + "': '" + esc(v) + "',"))
  fs.writeFileSync(file, lines.join('\n'))
  console.log('    → 写入 ' + written.length + ' 条')
}
console.log('\n合计 ' + grand + ' 条' + (DRY ? '(dry-run)' : ''))
}

main().catch((e) => { console.error('FAILED: ' + e.message); process.exit(1) })
