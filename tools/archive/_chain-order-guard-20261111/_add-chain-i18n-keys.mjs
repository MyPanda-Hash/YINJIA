/**
 * _add-chain-i18n-keys.mjs — 补「下方工序不能早于上方工序」校验的静态语言包词条
 * (2026-11-11,「工序顺序校验」任务的一次性产物)
 *
 * 3 条词条(整句 + `{d}` 占位,避免拼接串出全角标点):
 *   ① 提交拦截话术;
 *   ②③ 「已自动夹到上道完工日」的整句(调开工 / 调完工各一)。
 *
 * 做法:在每包 biz 词典里紧跟 `'计划开工日期不能晚于计划完工日期，已把完工日期调为 {d}'`
 * 那一行(2026-11-09 加的,每包唯一)后插入。幂等:已存在首条键就跳过。
 * 用法:node tools/archive/_chain-order-guard-20261111/_add-chain-i18n-keys.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(here, '../../../frontend/src/i18n/locales')

const KEYS = [
  '下道工序的计划开工日期不能早于上道工序的计划完工日期',
  '下道工序的计划开工日期不能早于上道工序的计划完工日期，已把开工日期调为 {d}',
  '下道工序的计划完工日期不能早于上道工序的计划完工日期，已把完工日期调为 {d}',
]

/** 语言包 → 与 KEYS 一一对应的 3 条译名 */
const T = {
  'en.js': [
    'A later operation cannot start before the previous operation finishes',
    'A later operation cannot start before the previous operation finishes; planned start adjusted to {d}',
    'A later operation cannot finish before the previous operation finishes; planned finish adjusted to {d}',
  ],
  'zh-TW.js': [
    '下道工序的計劃開工日期不能早於上道工序的計劃完工日期',
    '下道工序的計劃開工日期不能早於上道工序的計劃完工日期，已把開工日期調為 {d}',
    '下道工序的計劃完工日期不能早於上道工序的計劃完工日期，已把完工日期調為 {d}',
  ],
  'ja.js': [
    '次工程の計画開始日は前工程の計画完了日より前にできません',
    '次工程の計画開始日は前工程の計画完了日より前にできません。計画開始日を {d} に調整しました',
    '次工程の計画完了日は前工程の計画完了日より前にできません。計画完了日を {d} に調整しました',
  ],
  'ko.js': [
    '다음 공정의 계획 시작일은 이전 공정의 계획 완료일보다 빠를 수 없습니다',
    '다음 공정의 계획 시작일은 이전 공정의 계획 완료일보다 빠를 수 없습니다; 계획 시작일을 {d}로 조정했습니다',
    '다음 공정의 계획 완료일은 이전 공정의 계획 완료일보다 빠를 수 없습니다; 계획 완료일을 {d}로 조정했습니다',
  ],
  'es.js': [
    'La operación siguiente no puede empezar antes de que termine la anterior',
    'La operación siguiente no puede empezar antes de que termine la anterior; inicio previsto ajustado a {d}',
    'La operación siguiente no puede terminar antes de que termine la anterior; fin previsto ajustado a {d}',
  ],
  'fr.js': [
    "L'opération suivante ne peut pas commencer avant la fin de l'opération précédente",
    "L'opération suivante ne peut pas commencer avant la fin de l'opération précédente ; début prévu ajusté au {d}",
    "L'opération suivante ne peut pas se terminer avant la fin de l'opération précédente ; fin prévue ajustée au {d}",
  ],
  'de.js': [
    'Der nächste Arbeitsgang darf nicht vor dem Ende des vorherigen Arbeitsgangs beginnen',
    'Der nächste Arbeitsgang darf nicht vor dem Ende des vorherigen Arbeitsgangs beginnen; geplanter Start automatisch angepasst auf {d}',
    'Der nächste Arbeitsgang darf nicht vor dem Ende des vorherigen Arbeitsgangs enden; geplantes Ende automatisch angepasst auf {d}',
  ],
  'ru.js': [
    'Последующая операция не может начаться раньше завершения предыдущей',
    'Последующая операция не может начаться раньше завершения предыдущей; плановая дата начала скорректирована на {d}',
    'Последующая операция не может завершиться раньше предыдущей; плановая дата окончания скорректирована на {d}',
  ],
  'vi.js': [
    'Công đoạn sau không được bắt đầu trước khi công đoạn trước kết thúc',
    'Công đoạn sau không được bắt đầu trước khi công đoạn trước kết thúc; ngày bắt đầu dự kiến đã điều chỉnh thành {d}',
    'Công đoạn sau không được kết thúc trước khi công đoạn trước kết thúc; ngày kết thúc dự kiến đã điều chỉnh thành {d}',
  ],
  'th.js': [
    'ขั้นตอนถัดไปต้องไม่เริ่มก่อนที่ขั้นตอนก่อนหน้าจะสิ้นสุด',
    'ขั้นตอนถัดไปต้องไม่เริ่มก่อนที่ขั้นตอนก่อนหน้าจะสิ้นสุด; ปรับวันที่เริ่มตามแผนเป็น {d}',
    'ขั้นตอนถัดไปต้องไม่สิ้นสุดก่อนที่ขั้นตอนก่อนหน้าจะสิ้นสุด; ปรับวันที่สิ้นสุดตามแผนเป็น {d}',
  ],
}

const ANCHOR = '已把完工日期调为 {d}'
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

let changed = 0
for (const [file, texts] of Object.entries(T)) {
  const path = resolve(dir, file)
  const src = readFileSync(path, 'utf8')
  if (src.includes(`'${KEYS[0]}':`)) { console.log(`[skip] ${file} 已有词条`); continue }
  const lines = src.split(/\r?\n/)
  const idx = lines.findIndex((l) => l.includes(ANCHOR))
  if (idx < 0) throw new Error(`${file}: 找不到锚点 ${ANCHOR}`)
  const indent = lines[idx].match(/^\s*/)[0]
  const add = KEYS.map((k, i) => `${indent}'${k}': '${esc(texts[i])}',`)
  lines.splice(idx + 1, 0, ...add)
  writeFileSync(path, lines.join('\n'), 'utf8')
  console.log(`[ok] ${file} 插入 3 条(锚点 L${idx + 1})`)
  changed++
}
console.log(`完成:${changed} 个语言包更新`)
