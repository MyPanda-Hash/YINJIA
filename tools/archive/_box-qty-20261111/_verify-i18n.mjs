/**
 * _verify-i18n.mjs — 核对 10 个语言文件都拿到了「每箱数量」那 8 条词条,并做语法自检。
 * 用法:node tools/archive/_box-qty-20261111/_verify-i18n.mjs
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(here, '../../../frontend/src/i18n/locales')
const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']
const KEYS = [
  '每箱数量', '每箱', '整箱', '零头箱', '不足每箱（可单独打印零头箱）',
  '不填按本次打印数量',
  '标识卡上的「数量」印每箱数量（一箱一张卡）；打几张卡在打印预览里设置份数',
  '有零头箱：整批不是每箱数量的整数倍，零头箱数量不足每箱，可单独打印零头箱数量',
]

let bad = 0
for (const loc of LOCALES) {
  const file = resolve(dir, `${loc}.js`)
  const src = readFileSync(file, 'utf8')
  const miss = KEYS.filter((k) => !src.includes(`'${k}':`) && !src.includes(`"${k}":`))
  let syntax = 'ok'
  try {
    const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`)
    const biz = (mod.default?.biz) || {}
    const untranslated = KEYS.filter((k) => biz[k] && biz[k] === k)
    if (untranslated.length) syntax = `未翻译:${untranslated.join(',')}`
  } catch (e) {
    syntax = `语法失败:${e.message}`
  }
  if (miss.length || syntax !== 'ok') bad++
  console.log(`${loc.padEnd(6)} ${miss.length ? '缺词条:' + miss.length : '8/8'}  ${syntax}`)
}
console.log(bad ? `FAIL ${bad} 个语言有问题` : 'PASS 10/10 语言全部就绪')
process.exit(bad ? 1 : 0)
