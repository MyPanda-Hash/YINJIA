/*
 * _i18n-batch-no-20261019.cjs — 一次性:批次号口径改回「纯日期」的文案词条替换
 *
 * 背景(2026-10-19 用户口径):「批次号改回采用日期的方式,不再是供应商+日期」。
 * 弹窗批次号输入框的占位词原来是「生单时按供应商编码与当天日期生成」,口径已变 ⇒ 换成
 * 「生单时按当天日期生成」,并把 10 个语言包的译名同步换成"按当天日期生成"的说法。
 *
 * 用法: node tools/archive/_i18n-batch-no-20261019.cjs [--apply]
 *   不带 --apply 只打印将要改的行(干跑)。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const LOCALES = path.join(ROOT, 'frontend', 'src', 'i18n', 'locales')
const OLD_KEY = '生单时按供应商编码与当天日期生成'
const NEW_KEY = '生单时按当天日期生成'

// locale → 新译名(与旧句同义,只是去掉"供应商编码"这半句)
const TEXT = {
  en: 'Generated from the current date when the document is created',
  'zh-TW': '生單時按當天日期生成',
  ja: '伝票生成時に当日日付から生成',
  ko: '전표 생성 시 당일 날짜로 생성',
  es: 'Se genera con la fecha del día al crear el documento',
  fr: 'Généré depuis la date du jour à la création du document',
  de: 'Beim Belegerstellen aus dem Tagesdatum erzeugt',
  ru: 'Формируется при создании документа из текущей даты',
  vi: 'Được tạo từ ngày hiện tại khi lập chứng từ',
  th: 'สร้างจากวันที่ปัจจุบันเมื่อออกเอกสาร',
}

const apply = process.argv.includes('--apply')
let changed = 0
for (const [loc, text] of Object.entries(TEXT)) {
  const file = path.join(LOCALES, loc + '.js')
  const src = fs.readFileSync(file, 'utf8')
  const re = new RegExp(`^(\\s*)'${OLD_KEY}':\\s*'[^']*',?$`, 'm')
  if (!re.test(src)) {
    console.log(`[skip] ${loc}: 未找到旧词条`)
    continue
  }
  const next = src.replace(re, (m, indent) => `${indent}'${NEW_KEY}': '${text}',`)
  console.log(`[${apply ? 'apply' : 'dry'}] ${loc}: ${NEW_KEY} → ${text}`)
  if (apply) fs.writeFileSync(file, next, 'utf8')
  changed++
}
console.log(`\n${apply ? '已改写' : '将改写'} ${changed} 个语言包`)
