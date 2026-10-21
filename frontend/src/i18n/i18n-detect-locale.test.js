/**
 * i18n-detect-locale.test.js — 语言探测的回归钉(2026-10-21)
 *
 * 病根(现场实测):用户把语言切成 ja/ko/es/fr/de/ru/vi/th 后**刷新页面**,
 * `detectLocale()` 只认一份过时硬编码名单 ['zh-CN','zh-TW','en'] ⇒ 判定"不支持" ⇒ 回落 zh-CN
 * ⇒ **静态语言包根本不加载**(那 7 个语言的静态包各有 2300+ 条译名,一条都用不上),
 * 界面看着像"翻译没生效":只有 tt() 未命中后机翻的零星词条能出来;机翻降级时整屏中文。
 * (2026-10-21 接入三张工序检验单左目录时暴露:ja 下目录标题/列头仍是中文。)
 *
 * ⚠ 本测试**读源码钉住**而不是 import 运行时:前端单测跑在 node --test 下,没有 vite 的
 *   扩展名解析与别名(实测 import '../i18n/index.js' 会因 `./locales/zh-CN` 无扩展名而
 *   ERR_MODULE_NOT_FOUND)—— 与仓库既有做法一致(见 approvalSeparation.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const i18nSrc = readFileSync(new URL('./index.js', import.meta.url), 'utf8')

/** 取 PACKS 里声明的全部语言键(真源) */
function packLocales() {
  const block = i18nSrc.slice(i18nSrc.indexOf('const PACKS = {'), i18nSrc.indexOf('}', i18nSrc.indexOf('const PACKS = {')))
  return [...block.matchAll(/^\s*'?([a-zA-Z-]+)'?:\s*\(\)\s*=>\s*import\(/gm)].map((m) => m[1])
}

test('detectLocale 认的名单 = PACKS 声明的静态包(不再是一份过时硬编码)', () => {
  const packs = packLocales()
  assert.ok(packs.length >= 10, `PACKS 应声明 >=10 个静态包,实际 ${packs.length}: ${packs.join(',')}`)
  for (const loc of ['ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th', 'zh-TW', 'en']) {
    assert.ok(packs.includes(loc), `PACKS 缺 ${loc}`)
  }
  // 关键:已保存语言的判定必须走 STATIC_PACKED(= PACKS 键),而不是 SUPPORTED 那份旧名单
  assert.match(i18nSrc, /if \(saved && STATIC_PACKED\.includes\(saved\)\) return saved/,
    'detectLocale 必须按 STATIC_PACKED 判定"已保存的语言有没有静态包"')
  assert.doesNotMatch(i18nSrc, /if \(saved && SUPPORTED\.includes\(saved\)\)/,
    '不能再按 SUPPORTED(只有 zh-CN/zh-TW/en)判定 —— 那会让 ja/ko/… 刷新后回落中文')
})

test('STATIC_PACKED 由 PACKS 派生(加语言包即自动生效,不用改第二处)', () => {
  assert.match(i18nSrc, /export const STATIC_PACKED = \['zh-CN', \.\.\.Object\.keys\(PACKS\)\]/,
    'STATIC_PACKED 必须是「zh-CN + PACKS 键」,否则新增语言包又要手动补名单')
})

test('浏览器语言命中静态包时直接采用(不再一律回落中文)', () => {
  assert.match(i18nSrc, /const hit = STATIC_PACKED\.find\(/, 'detectLocale 应有浏览器语言→静态包的匹配')
  assert.match(i18nSrc, /nav\.startsWith\(l\.split\('-'\)\[0\] \+ '-'\)/, '应支持 zh-TW 这类带地区后缀的匹配')
})
