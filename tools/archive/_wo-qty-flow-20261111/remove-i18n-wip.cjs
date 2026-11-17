#!/usr/bin/env node
/**
 * 撤回「工序在制视图」时,把本任务加进 locale 的 11 条词条精确删掉(按 key 精确匹配,别误删别人的)。
 * 用法:node tools/archive/_wo-qty-flow-20261111/remove-i18n-wip.cjs
 */
const fs = require('fs')
const path = require('path')
const LOCALES = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')
const LANGS = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'vi', 'th']
const KEYS = [
  '工序在制',
  '该道计划量',
  '该道已完工',
  '可排产量',
  '不可排产量',
  '可排产量 = 可加工量 − 该道已完工(这条线现在能做的量)',
  '不可排产量 = 该道计划量 − 可加工量(前道还没流下来的量)',
  '上道已完工折成品',
  '最后报工时间',
  '工单当前工序',
  '超出可排产量,后端会拒绝(上限 = 可排产量 × 1.01)',
]
const wanted = new Set(KEYS)
let total = 0
for (const loc of LANGS) {
  const file = path.join(LOCALES, `${loc}.js`)
  if (!fs.existsSync(file)) continue
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const kept = []
  let removed = 0
  for (const line of lines) {
    const m = line.match(/^\s*"((?:[^"\\]|\\.)*)"\s*:\s*/)
    if (m) {
      const key = JSON.parse('"' + m[1] + '"')
      if (wanted.has(key)) { removed++; continue }
    }
    kept.push(line)
  }
  if (removed) {
    fs.writeFileSync(file, kept.join('\n'), 'utf8')
    total += removed
  }
  console.log(`${loc}: -${removed}`)
}
console.log(`DONE 共删除 ${total} 行`)
