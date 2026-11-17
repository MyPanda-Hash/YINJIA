#!/usr/bin/env node
/** 工单排产「按量流转·逐道明细(展开行)」补充词条（2026-11-12）。幂等。 */
const fs = require('fs')
const path = require('path')
const LOCALES = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const ENTRIES = {
  en: {
    '工序流转明细': 'Process Flow Detail',
    '按量流转:上一道报多少,下一道最多做多少': 'Flow by qty: the next process can only do what the previous one reported',
    '已审完工': 'Approved Output',
  },
  'zh-TW': {
    '工序流转明细': '工序流轉明細',
    '按量流转:上一道报多少,下一道最多做多少': '按量流轉:上一道報多少,下一道最多做多少',
    '已审完工': '已審完工',
  },
  ja: {
    '工序流转明细': '工程流れの明細',
    '按量流转:上一道报多少,下一道最多做多少': '量ベースの流れ:前工程の報告量だけ次工程で処理可能',
    '已审完工': '承認済み完成量',
  },
  ko: {
    '工序流转明细': '공정 흐름 상세',
    '按量流转:上一道报多少,下一道最多做多少': '수량 흐름: 이전 공정 보고량만큼만 다음 공정 가능',
    '已审完工': '승인 완료량',
  },
  de: {
    '工序流转明细': 'Vorgangsfluss-Details',
    '按量流转:上一道报多少,下一道最多做多少': 'Mengenfluss: der nächste Vorgang kann nur so viel wie der vorherige meldet',
    '已审完工': 'Freigegebene Menge',
  },
  es: {
    '工序流转明细': 'Detalle de flujo de procesos',
    '按量流转:上一道报多少,下一道最多做多少': 'Flujo por cantidad: el siguiente proceso solo puede hacer lo reportado por el anterior',
    '已审完工': 'Producción aprobada',
  },
  fr: {
    '工序流转明细': 'Détail du flux opératoire',
    '按量流转:上一道报多少,下一道最多做多少': "Flux par quantité : l'opération suivante ne peut traiter que ce que la précédente a déclaré",
    '已审完工': 'Production approuvée',
  },
  ru: {
    '工序流转明细': 'Детали потока операций',
    '按量流转:上一道报多少,下一道最多做多少': 'Поток по количеству: следующая операция может выполнить только отчитанное по предыдущей',
    '已审完工': 'Подтверждённый выпуск',
  },
  vi: {
    '工序流转明细': 'Chi tiết luân chuyển công đoạn',
    '按量流转:上一道报多少,下一道最多做多少': 'Luân chuyển theo SL: công đoạn sau chỉ làm được phần công đoạn trước đã báo',
    '已审完工': 'SL hoàn thành đã duyệt',
  },
  th: {
    '工序流转明细': 'รายละเอียดการโอนขั้นตอน',
    '按量流转:上一道报多少,下一道最多做多少': 'โอนตามปริมาณ: ขั้นตอนถัดไปทำได้เท่าที่ขั้นตอนก่อนหน้ารายงาน',
    '已审完工': 'ปริมาณที่อนุมัติแล้ว',
  },
}

let total = 0
for (const [loc, pairs] of Object.entries(ENTRIES)) {
  const file = path.join(LOCALES, `${loc}.js`)
  if (!fs.existsSync(file)) continue
  let src = fs.readFileSync(file, 'utf8')
  const add = []
  for (const [cn, tr] of Object.entries(pairs)) {
    const key = JSON.stringify(cn)
    if (src.includes(key + ':')) continue
    add.push(`    ${key}: ${JSON.stringify(tr)},`)
  }
  if (!add.length) { console.log(`SKIP ${loc}`); continue }
  const idx = src.lastIndexOf('\n  },')
  if (idx < 0) { console.log(`FAIL ${loc}`); continue }
  src = src.slice(0, idx + 1) + add.join('\n') + '\n' + src.slice(idx + 1)
  fs.writeFileSync(file, src, 'utf8')
  total += add.length
  console.log(`OK ${loc}(+${add.length})`)
}
console.log(`DONE ${total}`)
