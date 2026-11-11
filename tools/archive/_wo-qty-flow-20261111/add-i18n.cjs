#!/usr/bin/env node
/**
 * 工单工序按量流转(2026-11-11)新增 UI 文案的多语言词条。
 *
 * 只做一件事:把 5 条中文原文 → 目标语言,插进各 locale 的 **biz 块末尾**
 * (在文件末尾那个 `  },` 之前),不改变既有条目与顺序。
 * 幂等:已存在的键跳过(可重复执行)。
 *
 * 用法:node tools/archive/_wo-qty-flow-20261111/add-i18n.cjs
 */
const fs = require('fs')
const path = require('path')

const LOCALES = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

/** 中文原文 → 各语言译名(键必须与 Vue 里 tt('...') 的原文逐字一致) */
const ENTRIES = {
  en: {
    '可报': 'Reportable',
    '可加工量': 'Processable',
    '本道可报量 = 上一道已审核完工量(按量流转)': 'Reportable qty = approved output of the previous process (flow by quantity)',
    '前道工序还没有已审核完工量流入,请先报上一道工序': 'The previous process has no approved output yet — report the previous process first',
    '超出本道可报量': 'Exceeds the reportable qty of this process',
  },
  'zh-TW': {
    '可报': '可報',
    '可加工量': '可加工量',
    '本道可报量 = 上一道已审核完工量(按量流转)': '本道可報量 = 上一道已審核完工量(按量流轉)',
    '前道工序还没有已审核完工量流入,请先报上一道工序': '前道工序還沒有已審核完工量流入,請先報上一道工序',
    '超出本道可报量': '超出本道可報量',
  },
  ja: {
    '可报': '報告可能',
    '可加工量': '加工可能量',
    '本道可报量 = 上一道已审核完工量(按量流转)': '本工程の報告可能量 = 前工程の承認済み完成量(量ベースの流れ)',
    '前道工序还没有已审核完工量流入,请先报上一道工序': '前工程の承認済み完成量がまだありません。先に前工程を報告してください',
    '超出本道可报量': '本工程の報告可能量を超えています',
  },
  ko: {
    '可报': '보고 가능',
    '可加工量': '가공 가능량',
    '本道可报量 = 上一道已审核完工量(按量流转)': '이 공정 보고 가능량 = 이전 공정 승인 완료량(수량 흐름)',
    '前道工序还没有已审核完工量流入,请先报上一道工序': '이전 공정의 승인 완료량이 아직 없습니다. 먼저 이전 공정을 보고하세요',
    '超出本道可报量': '이 공정의 보고 가능량을 초과했습니다',
  },
  de: {
    '可报': 'Meldbar',
    '可加工量': 'Bearbeitbar',
    '本道可报量 = 上一道已审核完工量(按量流转)': 'Meldbare Menge = freigegebene Menge des vorherigen Vorgangs (Mengenfluss)',
    '前道工序还没有已审核完工量流入,请先报上一道工序': 'Vom vorherigen Vorgang liegt noch keine freigegebene Menge vor – bitte zuerst den vorherigen Vorgang melden',
    '超出本道可报量': 'Übersteigt die meldbare Menge dieses Vorgangs',
  },
  es: {
    '可报': 'Reportable',
    '可加工量': 'Procesable',
    '本道可报量 = 上一道已审核完工量(按量流转)': 'Cantidad reportable = producción aprobada del proceso anterior (flujo por cantidad)',
    '前道工序还没有已审核完工量流入,请先报上一道工序': 'El proceso anterior aún no tiene producción aprobada; reporte primero el proceso anterior',
    '超出本道可报量': 'Supera la cantidad reportable de este proceso',
  },
  fr: {
    '可报': 'Déclarable',
    '可加工量': 'Traitable',
    '本道可报量 = 上一道已审核完工量(按量流转)': "Quantité déclarable = production approuvée de l'opération précédente (flux par quantité)",
    '前道工序还没有已审核完工量流入,请先报上一道工序': "L'opération précédente n'a pas encore de production approuvée ; déclarez d'abord l'opération précédente",
    '超出本道可报量': 'Dépasse la quantité déclarable de cette opération',
  },
  ru: {
    '可报': 'К отчёту',
    '可加工量': 'Обрабатываемое',
    '本道可报量 = 上一道已审核完工量(按量流转)': 'Количество к отчёту = подтверждённый выпуск предыдущей операции (поток по количеству)',
    '前道工序还没有已审核完工量流入,请先报上一道工序': 'По предыдущей операции ещё нет подтверждённого выпуска — сначала отчитайтесь по предыдущей операции',
    '超出本道可报量': 'Превышает количество к отчёту для этой операции',
  },
  vi: {
    '可报': 'Có thể báo cáo',
    '可加工量': 'Có thể gia công',
    '本道可报量 = 上一道已审核完工量(按量流转)': 'SL có thể báo cáo = SL hoàn thành đã duyệt của công đoạn trước (luân chuyển theo SL)',
    '前道工序还没有已审核完工量流入,请先报上一道工序': 'Công đoạn trước chưa có SL hoàn thành đã duyệt, hãy báo cáo công đoạn trước trước',
    '超出本道可报量': 'Vượt quá SL có thể báo cáo của công đoạn này',
  },
  th: {
    '可报': 'รายงานได้',
    '可加工量': 'ปริมาณที่ทำได้',
    '本道可报量 = 上一道已审核完工量(按量流转)': 'ปริมาณที่รายงานได้ = ปริมาณที่อนุมัติแล้วของขั้นตอนก่อนหน้า (โอนตามปริมาณ)',
    '前道工序还没有已审核完工量流入,请先报上一道工序': 'ขั้นตอนก่อนหน้ายังไม่มีปริมาณที่อนุมัติแล้ว กรุณารายงานขั้นตอนก่อนหน้าก่อน',
    '超出本道可报量': 'เกินปริมาณที่รายงานได้ของขั้นตอนนี้',
  },
}

let total = 0
for (const [loc, pairs] of Object.entries(ENTRIES)) {
  const file = path.join(LOCALES, `${loc}.js`)
  if (!fs.existsSync(file)) { console.log(`SKIP ${loc}(文件不存在)`); continue }
  let src = fs.readFileSync(file, 'utf8')
  const add = []
  for (const [cn, tr] of Object.entries(pairs)) {
    const key = JSON.stringify(cn)
    // 已存在(键出现)则跳过 —— 幂等
    if (src.includes(key + ':') || src.includes(key + ' :')) continue
    add.push(`    ${key}: ${JSON.stringify(tr)},`)
  }
  if (!add.length) { console.log(`SKIP ${loc}(词条已存在)`); continue }
  // 插到 biz 块末尾:文件最后一个 `  },` 之前(该行就是 biz 的收尾)
  const idx = src.lastIndexOf('\n  },')
  if (idx < 0) { console.log(`FAIL ${loc}(找不到 biz 收尾)`); continue }
  src = src.slice(0, idx + 1) + add.join('\n') + '\n' + src.slice(idx + 1)
  fs.writeFileSync(file, src, 'utf8')
  total += add.length
  console.log(`OK ${loc}(+${add.length})`)
}
console.log(`DONE 共写入 ${total} 条词条`)
