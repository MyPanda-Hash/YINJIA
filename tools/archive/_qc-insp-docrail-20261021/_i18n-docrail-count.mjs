import fs from 'node:fs'

/**
 * _i18n-docrail-count.mjs — 左「单据选择」栏的「共有数据」计数句(2026-10-21)
 *
 * 背景:三张工序检验单(制程/首件/组装成品)接入左目录后,英文界面下这一行显示成
 *   `Total records: 447 条` —— 「条」是量词,单独翻成 "records" 会变成 `records: 447 records`。
 * 改法:整句做一个带占位符的词条 `共有数据: {n} 条`(n 由调用处替换),各语言按自己的语序给整句:
 *   zh-CN 共有数据: 447 条 / en Total: 447 / ja 全件数: 447 件 / …
 * 幂等:已有该键则跳过;插入锚点 = 各语言包首件检验那批的「只列未完工的工单行…」行。
 */
const KEY = '共有数据: {n} 条'
const ANCHOR = '    "只列未完工的工单行；已完工、已结案或已有首件检验单的工单行不再列出。":'

const BLOCKS = {
  'zh-TW': '共有資料: {n} 筆',
  en: 'Total: {n}',
  ja: '全件数: {n} 件',
  ko: '전체: {n} 건',
  es: 'Total: {n}',
  fr: 'Total : {n}',
  de: 'Gesamt: {n}',
  ru: 'Всего: {n}',
  vi: 'Tổng số: {n}',
  th: 'ทั้งหมด: {n} รายการ',
}

let files = 0
let added = 0
for (const [loc, text] of Object.entries(BLOCKS)) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  let s = fs.readFileSync(p, 'utf8')
  if (s.includes(JSON.stringify(KEY) + ':')) { console.log(`SKIP ${loc}: 已存在`); continue }
  const i = s.indexOf(ANCHOR)
  if (i < 0) { console.log(`SKIP ${loc}: 锚点缺失`); continue }
  s = s.slice(0, i) + `    ${JSON.stringify(KEY)}: ${JSON.stringify(text)},\n` + s.slice(i)
  fs.writeFileSync(p, s, 'utf8')
  files++
  added++
  console.log(`OK   ${loc}: ${text}`)
}
console.log(`\n共 ${files} 个语言包 / ${added} 条词条`)
