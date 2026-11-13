/**
 * _verify-i18n.mjs — 核对 10 个语言文件都拿到了「每箱数量」第二轮 7 条词条,并做语法自检;
 * 同时确认第一轮那 4 条已被口径变更的旧词条**已删除**(用户明确「不要有这个提示」)。
 * 用法:node tools/archive/_box-qty-20261111/_verify-i18n.mjs
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(here, '../../../frontend/src/i18n/locales')
const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']

/** 必须存在的词条(第二轮口径) */
const KEYS = [
  '每箱数量', '每箱', '整箱', '零头箱',
  '必填', '共 {n} 张', '零头不足一箱，已自动出卡',
  '请填写每箱数量（必填）',
  '按每箱数量算出的标签张数过多（{n} 张），请核对每箱数量',
  '有零头箱：整批不是每箱数量的整数倍，零头箱会单独出一张卡（卡面印零头数量）',
  '标签张数',
]
/** 已废弃、必须不存在的词条 */
const GONE = [
  '不填按本次打印数量',
  '标识卡上的「数量」印每箱数量（一箱一张卡）；打几张卡在打印预览里设置份数',
  '有零头箱：整批不是每箱数量的整数倍，零头箱数量不足每箱，可单独打印零头箱数量',
  '不足每箱（可单独打印零头箱）',
]

let bad = 0
for (const loc of LOCALES) {
  const file = resolve(dir, `${loc}.js`)
  const src = readFileSync(file, 'utf8')
  const miss = KEYS.filter((k) => !src.includes(`'${k}':`) && !src.includes(`"${k}":`))
  const leftover = GONE.filter((k) => src.includes(`'${k}':`))
  let syntax = 'ok'
  try {
    const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`)
    const biz = mod.default?.biz || {}
    const blank = KEYS.filter((k) => biz[k] !== undefined && String(biz[k]).trim() === '')
    if (blank.length) syntax = `译文为空:${blank.join(',')}`
  } catch (e) {
    syntax = `语法失败:${e.message}`
  }
  if (miss.length || leftover.length || syntax !== 'ok') bad++
  console.log(`${loc.padEnd(6)} ${KEYS.length - miss.length}/${KEYS.length}  残留旧词条:${leftover.length}  ${syntax}`)
}
console.log(bad ? `FAIL ${bad} 个语言有问题` : 'PASS 10/10 语言全部就绪(旧词条已清)')
process.exit(bad ? 1 : 0)
