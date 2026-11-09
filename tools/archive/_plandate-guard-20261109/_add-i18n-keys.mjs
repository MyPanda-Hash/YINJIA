/**
 * _add-i18n-keys.mjs — 给「计划开工日期不得晚于计划完工日期」校验补静态语言包词条
 * (2026-11-09,PlanDate guard 任务的一次性产物)
 *
 * 3 条词条:
 *   ① 校验话术(提交拦截 / 排产快速调整弹窗前置校验都用它);
 *   ②③ 「已自动调平」整句 —— **整句一条**,`{d}` 由调用方 replace 成日期。
 *       (最初拆成「原因」+「已自动把开工日期调为」两段拼接,英文里会串出全角逗号,2026-11-09 当天就改成整句。)
 *
 * 做法:在每个静态语言包的 biz 词典里,**紧跟** `'计划开工日期'` 那一行后插入 3 条新词条
 * (该键在每个语言包里都只出现 1 次,可作唯一锚点)。幂等:已存在首条键就跳过。
 * 只动文本、不改格式/不重排。
 *
 * 用法:node tools/archive/_plandate-guard-20261109/_add-i18n-keys.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(here, '../../../frontend/src/i18n/locales')

const KEYS = [
  '计划开工日期不能晚于计划完工日期',
  '计划开工日期不能晚于计划完工日期，已把开工日期调为 {d}',
  '计划开工日期不能晚于计划完工日期，已把完工日期调为 {d}',
]

/** 语言包 → 与 KEYS 一一对应的 3 条译名 */
const T = {
  'en.js': [
    'Planned start cannot be later than planned finish',
    'Planned start cannot be later than planned finish; planned start adjusted to {d}',
    'Planned start cannot be later than planned finish; planned finish adjusted to {d}',
  ],
  'zh-TW.js': [
    '計劃開工日期不能晚於計劃完工日期',
    '計劃開工日期不能晚於計劃完工日期，已把開工日期調為 {d}',
    '計劃開工日期不能晚於計劃完工日期，已把完工日期調為 {d}',
  ],
  'ja.js': [
    '計画開始日は計画完了日より後にできません',
    '計画開始日は計画完了日より後にできません。計画開始日を {d} に調整しました',
    '計画開始日は計画完了日より後にできません。計画完了日を {d} に調整しました',
  ],
  'ko.js': [
    '계획 시작일은 계획 완료일보다 늦을 수 없습니다',
    '계획 시작일은 계획 완료일보다 늦을 수 없습니다. 계획 시작일을 {d}(으)로 자동 조정했습니다',
    '계획 시작일은 계획 완료일보다 늦을 수 없습니다. 계획 완료일을 {d}(으)로 자동 조정했습니다',
  ],
  'es.js': [
    'La fecha de inicio prevista no puede ser posterior a la fecha de fin prevista',
    'La fecha de inicio prevista no puede ser posterior a la de fin prevista; inicio previsto ajustado a {d}',
    'La fecha de inicio prevista no puede ser posterior a la de fin prevista; fin previsto ajustado a {d}',
  ],
  'fr.js': [
    'La date de début prévue ne peut pas être postérieure à la date de fin prévue',
    'La date de début prévue ne peut pas être postérieure à la date de fin prévue ; début prévu ajusté au {d}',
    'La date de début prévue ne peut pas être postérieure à la date de fin prévue ; fin prévue ajustée au {d}',
  ],
  'de.js': [
    'Der geplante Start darf nicht nach dem geplanten Ende liegen',
    'Der geplante Start darf nicht nach dem geplanten Ende liegen; geplanter Start automatisch angepasst auf {d}',
    'Der geplante Start darf nicht nach dem geplanten Ende liegen; geplantes Ende automatisch angepasst auf {d}',
  ],
  'ru.js': [
    'Плановая дата начала не может быть позже плановой даты окончания',
    'Плановая дата начала не может быть позже плановой даты окончания; плановая дата начала скорректирована на {d}',
    'Плановая дата начала не может быть позже плановой даты окончания; плановая дата окончания скорректирована на {d}',
  ],
  'vi.js': [
    'Ngày bắt đầu dự kiến không được muộn hơn ngày kết thúc dự kiến',
    'Ngày bắt đầu dự kiến không được muộn hơn ngày kết thúc dự kiến; ngày bắt đầu dự kiến đã điều chỉnh thành {d}',
    'Ngày bắt đầu dự kiến không được muộn hơn ngày kết thúc dự kiến; ngày kết thúc dự kiến đã điều chỉnh thành {d}',
  ],
  'th.js': [
    'วันที่เริ่มตามแผนต้องไม่เกินวันที่สิ้นสุดตามแผน',
    'วันที่เริ่มตามแผนต้องไม่เกินวันที่สิ้นสุดตามแผน; ปรับวันที่เริ่มตามแผนเป็น {d}',
    'วันที่เริ่มตามแผนต้องไม่เกินวันที่สิ้นสุดตามแผน; ปรับวันที่สิ้นสุดตามแผนเป็น {d}',
  ],
}

const ANCHOR = "'计划开工日期':"
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
