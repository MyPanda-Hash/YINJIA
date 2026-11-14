/**
 * _i18n-patch3.mjs — 零头提示措辞微调(2026-11-11 第三轮)
 *
 * 上一轮拼出来是「共 13 张（整箱 12 + 零头箱 50 不足每箱（自动出零头卡））」—— 双层括号不好读。
 * 把词条从「不足每箱（自动出零头卡）」改成「零头不足一箱，已自动出卡」,拼出来是:
 *   「行号 1：每箱 200 ⇒ 共 13 张（整箱 12 + 零头箱 50，零头不足一箱，已自动出卡）」
 *
 * 幂等:新键已存在则跳过;旧键在每个语言文件里删掉。用法:
 *   node tools/archive/_box-qty-20261111/_i18n-patch3.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const localesDir = resolve(here, '../../../frontend/src/i18n/locales')

const OLD_KEY = '不足每箱（自动出零头卡）'
const NEW_KEY = '零头不足一箱，已自动出卡'
const TEXT = {
  en: 'the partial box is under a full box; its label is printed automatically',
  'zh-TW': '零頭不足一箱，已自動出卡',
  ja: '端数箱は1箱未満のため自動発行',
  ko: '잔여 상자는 1상자 미만이라 자동 발행',
  de: 'Restkarton unter einer vollen Kiste, Etikett automatisch gedruckt',
  es: 'la caja parcial no llega a una caja completa y se imprime automáticamente',
  fr: 'boîte partielle incomplète, étiquette imprimée automatiquement',
  ru: 'неполная коробка, этикетка печатается автоматически',
  th: 'กล่องไม่เต็ม พิมพ์ป้ายให้อัตโนมัติ',
  vi: 'thùng lẻ chưa đầy, nhãn được in tự động',
}

const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

for (const loc of LOCALES) {
  const file = resolve(localesDir, `${loc}.js`)
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  let removed = 0
  const oldRx = new RegExp(`^\\s*'${esc(OLD_KEY)}':\\s*.*$`)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (oldRx.test(lines[i])) { lines.splice(i, 1); removed++ }
  }
  let inserted = 0
  if (!lines.some((l) => l.includes(`'${NEW_KEY}':`))) {
    const idx = lines.findIndex((l) => /^(\s*)'每箱数量':/.test(l))
    if (idx < 0) { console.error(`${loc}: 找不到锚点,跳过`); continue }
    const indent = lines[idx].match(/^(\s*)/)[1]
    lines.splice(idx + 1, 0, `${indent}${q(NEW_KEY)}: ${q(TEXT[loc] ?? TEXT.en)},`)
    inserted = 1
  }
  writeFileSync(file, lines.join('\n'), 'utf8')
  console.log(`${loc}: 删旧 ${removed} 条,插新 ${inserted} 条`)
}
