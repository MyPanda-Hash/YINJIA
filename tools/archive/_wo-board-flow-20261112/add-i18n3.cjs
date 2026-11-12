#!/usr/bin/env node
/** 工单排产「本线工序任务」标记词条（2026-11-12）。幂等。 */
const fs = require('fs')
const path = require('path')
const LOCALES = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const ENTRIES = {
  en: {
    '本线待做': 'To do on this line',
    '该工序排在本线,但工单当前工序在别的产线': 'This process is assigned to this line, while the work order current process is on another line',
  },
  'zh-TW': {
    '本线待做': '本線待做',
    '该工序排在本线,但工单当前工序在别的产线': '該工序排在本線,但工單當前工序在別的產線',
  },
  ja: {
    '本线待做': '本ライン未処理',
    '该工序排在本线,但工单当前工序在别的产线': 'この工程は本ラインに割当済みですが、工単の現在工程は別ラインです',
  },
  ko: {
    '本线待做': '본 라인 대기',
    '该工序排在本线,但工单当前工序在别的产线': '이 공정은 본 라인에 배정되었지만 작업지시의 현재 공정은 다른 라인에 있습니다',
  },
  de: {
    '本线待做': 'Auf dieser Linie offen',
    '该工序排在本线,但工单当前工序在别的产线': 'Dieser Vorgang ist dieser Linie zugeordnet, der aktuelle Vorgang des Auftrags liegt jedoch auf einer anderen Linie',
  },
  es: {
    '本线待做': 'Pendiente en esta línea',
    '该工序排在本线,但工单当前工序在别的产线': 'Este proceso está asignado a esta línea, pero el proceso actual de la orden está en otra línea',
  },
  fr: {
    '本线待做': 'À faire sur cette ligne',
    '该工序排在本线,但工单当前工序在别的产线': "Cette opération est affectée à cette ligne, mais l'opération courante de l'ordre est sur une autre ligne",
  },
  ru: {
    '本线待做': 'К работе на этой линии',
    '该工序排在本线,但工单当前工序在别的产线': 'Эта операция закреплена за этой линией, но текущая операция заказа на другой линии',
  },
  vi: {
    '本线待做': 'Chờ làm tại chuyền này',
    '该工序排在本线,但工单当前工序在别的产线': 'Công đoạn này được xếp cho chuyền này, nhưng công đoạn hiện tại của lệnh đang ở chuyền khác',
  },
  th: {
    '本线待做': 'รอทำที่ไลน์นี้',
    '该工序排在本线,但工单当前工序在别的产线': 'ขั้นตอนนี้ถูกจัดให้ไลน์นี้ แต่ขั้นตอนปัจจุบันของใบสั่งงานอยู่ที่ไลน์อื่น',
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
