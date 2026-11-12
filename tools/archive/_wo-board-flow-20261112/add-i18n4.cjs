#!/usr/bin/env node
/** 「上道完工量 / 可加工量」列头 tooltip 词条（2026-11-12 清理口径后）。幂等。 */
const fs = require('fs')
const path = require('path')
const LOCALES = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const K1 = '上道完工量 = 上一道已审核报工数(上一道自己的计量单位,不折算);换算率不同时,本道能做多少看「可加工量」'
const K2 = '可加工量 = 上一道流下来的量(已按换算率折到本道单位),也就是本道现在最多能做多少'

const ENTRIES = {
  en: {
    [K1]: 'Upstream completed qty = approved output of the previous process (in its own unit, not converted); when conversion rates differ, see "Processable" for how much this process can do',
    [K2]: 'Processable = quantity flowed in from the previous process (already converted to this process unit) — the maximum this process can do now',
  },
  'zh-TW': {
    [K1]: '上道完工量 = 上一道已審核報工數(上一道自己的計量單位,不折算);換算率不同時,本道能做多少看「可加工量」',
    [K2]: '可加工量 = 上一道流下來的量(已按換算率折到本道單位),也就是本道現在最多能做多少',
  },
  ja: {
    [K1]: '前工程完工量 = 前工程の承認済み完成量(前工程の単位、換算なし);換算率が異なる場合、本工程でできる量は「加工可能量」を参照',
    [K2]: '加工可能量 = 前工程から流れてきた量(本工程の単位に換算済み)。本工程で現在できる最大量',
  },
  ko: {
    [K1]: '이전 공정 완료량 = 이전 공정의 승인 완료량(이전 공정 단위, 환산 없음); 환산율이 다르면 본 공정 가능량은 「가공 가능량」 참조',
    [K2]: '가공 가능량 = 이전 공정에서 넘어온 수량(본 공정 단위로 환산됨). 본 공정에서 지금 할 수 있는 최대량',
  },
  de: {
    [K1]: 'Vorgang-Ausbringung = freigegebene Menge des vorherigen Vorgangs (in dessen Einheit, nicht umgerechnet); bei unterschiedlichen Faktoren siehe "Bearbeitbar"',
    [K2]: 'Bearbeitbar = aus dem vorherigen Vorgang zugeflossene Menge (bereits in diese Einheit umgerechnet)',
  },
  es: {
    [K1]: 'Producción anterior = producción aprobada del proceso anterior (en su unidad, sin convertir); si los factores difieren, ver "Procesable"',
    [K2]: 'Procesable = cantidad que entró del proceso anterior (ya convertida a la unidad de este proceso)',
  },
  fr: {
    [K1]: "Production amont = production approuvée de l'opération précédente (dans son unité, non convertie); si les taux diffèrent, voir « Traitable »",
    [K2]: "Traitable = quantité entrée depuis l'opération précédente (déjà convertie dans l'unité de cette opération)",
  },
  ru: {
    [K1]: 'Выпуск предыдущей операции = подтверждённый выпуск (в её единицах, без пересчёта); при разных коэффициентах см. «Обрабатываемое»',
    [K2]: 'Обрабатываемое = количество, поступившее от предыдущей операции (уже пересчитано в единицы этой операции)',
  },
  vi: {
    [K1]: 'Công đoạn trước hoàn thành = SL đã duyệt của công đoạn trước (theo đơn vị của công đoạn đó, không quy đổi); nếu hệ số khác, xem "Có thể gia công"',
    [K2]: 'Có thể gia công = SL chảy từ công đoạn trước (đã quy đổi sang đơn vị công đoạn này)',
  },
  th: {
    [K1]: 'ปริมาณเสร็จขั้นตอนก่อนหน้า = ปริมาณที่อนุมัติของขั้นตอนก่อนหน้า (หน่วยของขั้นตอนนั้น ไม่แปลง); ถ้าอัตราแปลงต่างกัน ดู "ปริมาณที่ทำได้"',
    [K2]: 'ปริมาณที่ทำได้ = ปริมาณที่ไหลจากขั้นตอนก่อนหน้า (แปลงเป็นหน่วยของขั้นตอนนี้แล้ว)',
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
