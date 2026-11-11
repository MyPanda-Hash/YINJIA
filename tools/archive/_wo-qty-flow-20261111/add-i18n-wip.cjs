#!/usr/bin/env node
/**
 * 工序在制视图(2026-11-11)新增文案的 10 语言词条。插到各 locale 的 biz 块末尾;已存在则跳过(幂等)。
 * 用法:node tools/archive/_wo-qty-flow-20261111/add-i18n-wip.cjs
 */
const fs = require('fs')
const path = require('path')
const LOCALES = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const ENTRIES = {
  en: {
    '工序在制': 'Process WIP',
    '该道计划量': 'Process planned qty',
    '该道已完工': 'Process completed',
    '可排产量': 'Schedulable qty',
    '不可排产量': 'Unschedulable qty',
    '可排产量 = 可加工量 − 该道已完工(这条线现在能做的量)': 'Schedulable qty = processable qty − completed qty of this process (what this line can do now)',
    '不可排产量 = 该道计划量 − 可加工量(前道还没流下来的量)': 'Unschedulable qty = planned qty of this process − processable qty (still not flowed from the previous process)',
    '上道已完工折成品': 'Prev process completed (FG basis)',
    '最后报工时间': 'Last report time',
    '工单当前工序': 'WO current process',
    '超出可排产量,后端会拒绝(上限 = 可排产量 × 1.01)': 'Exceeds the schedulable qty; the server will reject it (max = schedulable qty × 1.01)',
  },
  'zh-TW': {
    '工序在制': '工序在製',
    '该道计划量': '該道計畫量',
    '该道已完工': '該道已完工',
    '可排产量': '可排產量',
    '不可排产量': '不可排產量',
    '可排产量 = 可加工量 − 该道已完工(这条线现在能做的量)': '可排產量 = 可加工量 − 該道已完工(這條線現在能做的量)',
    '不可排产量 = 该道计划量 − 可加工量(前道还没流下来的量)': '不可排產量 = 該道計畫量 − 可加工量(前道還沒流下來的量)',
    '上道已完工折成品': '上道已完工折成品',
    '最后报工时间': '最後報工時間',
    '工单当前工序': '工單當前工序',
    '超出可排产量,后端会拒绝(上限 = 可排产量 × 1.01)': '超出可排產量,後端會拒絕(上限 = 可排產量 × 1.01)',
  },
  ja: {
    '工序在制': '工程仕掛',
    '该道计划量': '当工程計画数',
    '该道已完工': '当工程完成数',
    '可排产量': '割当可能数',
    '不可排产量': '割当不可数',
    '可排产量 = 可加工量 − 该道已完工(这条线现在能做的量)': '割当可能数 = 加工可能数 − 当工程完成数(このラインで今できる量)',
    '不可排产量 = 该道计划量 − 可加工量(前道还没流下来的量)': '割当不可数 = 当工程計画数 − 加工可能数(前工程からまだ流れてきていない量)',
    '上道已完工折成品': '前工程完成数(完成品換算)',
    '最后报工时间': '最終報告時刻',
    '工单当前工序': '指示書の現工程',
    '超出可排产量,后端会拒绝(上限 = 可排产量 × 1.01)': '割当可能数を超えています。サーバーで拒否されます(上限 = 割当可能数 × 1.01)',
  },
  ko: {
    '工序在制': '공정 재공',
    '该道计划量': '해당 공정 계획량',
    '该道已完工': '해당 공정 완료량',
    '可排产量': '배정 가능량',
    '不可排产量': '배정 불가량',
    '可排产量 = 可加工量 − 该道已完工(这条线现在能做的量)': '배정 가능량 = 가공 가능량 − 해당 공정 완료량(이 라인에서 지금 할 수 있는 양)',
    '不可排产量 = 该道计划量 − 可加工量(前道还没流下来的量)': '배정 불가량 = 해당 공정 계획량 − 가공 가능량(이전 공정에서 아직 내려오지 않은 양)',
    '上道已完工折成品': '이전 공정 완료(완제품 환산)',
    '最后报工时间': '최종 보고 시각',
    '工单当前工序': '작업지시 현재 공정',
    '超出可排产量,后端会拒绝(上限 = 可排产量 × 1.01)': '배정 가능량을 초과했습니다. 서버에서 거부됩니다(상한 = 배정 가능량 × 1.01)',
  },
  de: {
    '工序在制': 'Vorgang in Arbeit',
    '该道计划量': 'Geplante Menge (Vorgang)',
    '该道已完工': 'Erledigt (Vorgang)',
    '可排产量': 'Einplanbare Menge',
    '不可排产量': 'Nicht einplanbare Menge',
    '可排产量 = 可加工量 − 该道已完工(这条线现在能做的量)': 'Einplanbare Menge = bearbeitbare Menge − erledigte Menge (was diese Linie jetzt schaffen kann)',
    '不可排产量 = 该道计划量 − 可加工量(前道还没流下来的量)': 'Nicht einplanbare Menge = geplante Menge − bearbeitbare Menge (noch nicht vom vorherigen Vorgang zugeflossen)',
    '上道已完工折成品': 'Vorheriger Vorgang erledigt (FG-Basis)',
    '最后报工时间': 'Letzte Meldung',
    '工单当前工序': 'Aktueller Vorgang des Auftrags',
    '超出可排产量,后端会拒绝(上限 = 可排产量 × 1.01)': 'Übersteigt die einplanbare Menge; der Server lehnt ab (max = einplanbare Menge × 1.01)',
  },
  es: {
    '工序在制': 'Proceso en curso',
    '该道计划量': 'Cant. planificada del proceso',
    '该道已完工': 'Completado del proceso',
    '可排产量': 'Cant. programable',
    '不可排产量': 'Cant. no programable',
    '可排产量 = 可加工量 − 该道已完工(这条线现在能做的量)': 'Cant. programable = cant. procesable − completado del proceso (lo que esta línea puede hacer ahora)',
    '不可排产量 = 该道计划量 − 可加工量(前道还没流下来的量)': 'Cant. no programable = cant. planificada − cant. procesable (aún no viene del proceso anterior)',
    '上道已完工折成品': 'Proceso anterior completado (base PT)',
    '最后报工时间': 'Último reporte',
    '工单当前工序': 'Proceso actual de la OF',
    '超出可排产量,后端会拒绝(上限 = 可排产量 × 1.01)': 'Supera la cant. programable; el servidor lo rechazará (máx = cant. programable × 1.01)',
  },
  fr: {
    '工序在制': 'En-cours opération',
    '该道计划量': 'Qté prévue de l’opération',
    '该道已完工': 'Réalisé de l’opération',
    '可排产量': 'Qté planifiable',
    '不可排产量': 'Qté non planifiable',
    '可排产量 = 可加工量 − 该道已完工(这条线现在能做的量)': 'Qté planifiable = qté traitable − réalisé de l’opération (ce que cette ligne peut faire maintenant)',
    '不可排产量 = 该道计划量 − 可加工量(前道还没流下来的量)': 'Qté non planifiable = qté prévue − qté traitable (pas encore transférée de l’opération précédente)',
    '上道已完工折成品': 'Opération précédente réalisée (base PF)',
    '最后报工时间': 'Dernier pointage',
    '工单当前工序': 'Opération courante de l’OF',
    '超出可排产量,后端会拒绝(上限 = 可排产量 × 1.01)': 'Dépasse la qté planifiable ; le serveur refusera (max = qté planifiable × 1.01)',
  },
  ru: {
    '工序在制': 'Операция в работе',
    '该道计划量': 'Плановое кол-во операции',
    '该道已完工': 'Выполнено по операции',
    '可排产量': 'К распределению',
    '不可排产量': 'Не к распределению',
    '可排产量 = 可加工量 − 该道已完工(这条线现在能做的量)': 'К распределению = доступно к обработке − выполнено (сколько эта линия может сделать сейчас)',
    '不可排产量 = 该道计划量 − 可加工量(前道还没流下来的量)': 'Не к распределению = плановое кол-во − доступно к обработке (ещё не поступило с предыдущей операции)',
    '上道已完工折成品': 'Предыдущая операция выполнена (в ГП)',
    '最后报工时间': 'Последняя выработка',
    '工单当前工序': 'Текущая операция заказа',
    '超出可排产量,后端会拒绝(上限 = 可排产量 × 1.01)': 'Превышает кол-во к распределению; сервер отклонит (макс = кол-во к распределению × 1.01)',
  },
  vi: {
    '工序在制': 'Công đoạn đang làm',
    '该道计划量': 'SL kế hoạch công đoạn',
    '该道已完工': 'Đã hoàn thành công đoạn',
    '可排产量': 'SL có thể xếp',
    '不可排产量': 'SL chưa thể xếp',
    '可排产量 = 可加工量 − 该道已完工(这条线现在能做的量)': 'SL có thể xếp = SL có thể gia công − đã hoàn thành (lượng tuyến này làm được ngay)',
    '不可排产量 = 该道计划量 − 可加工量(前道还没流下来的量)': 'SL chưa thể xếp = SL kế hoạch − SL có thể gia công (công đoạn trước chưa chuyển xuống)',
    '上道已完工折成品': 'Công đoạn trước đã xong (quy thành phẩm)',
    '最后报工时间': 'Lần báo cáo cuối',
    '工单当前工序': 'Công đoạn hiện tại của lệnh',
    '超出可排产量,后端会拒绝(上限 = 可排产量 × 1.01)': 'Vượt SL có thể xếp; máy chủ sẽ từ chối (tối đa = SL có thể xếp × 1.01)',
  },
  th: {
    '工序在制': 'งานระหว่างขั้นตอน',
    '该道计划量': 'ปริมาณตามแผนของขั้นตอน',
    '该道已完工': 'เสร็จแล้วของขั้นตอน',
    '可排产量': 'ปริมาณที่จัดได้',
    '不可排产量': 'ปริมาณที่จัดไม่ได้',
    '可排产量 = 可加工量 − 该道已完工(这条线现在能做的量)': 'ปริมาณที่จัดได้ = ปริมาณที่ทำได้ − ที่เสร็จแล้ว (ปริมาณที่ไลน์นี้ทำได้ตอนนี้)',
    '不可排产量 = 该道计划量 − 可加工量(前道还没流下来的量)': 'ปริมาณที่จัดไม่ได้ = ปริมาณตามแผน − ปริมาณที่ทำได้ (ยังไม่ไหลลงมาจากขั้นตอนก่อนหน้า)',
    '上道已完工折成品': 'ขั้นตอนก่อนหน้าเสร็จ (เทียบสำเร็จรูป)',
    '最后报工时间': 'เวลารายงานครั้งล่าสุด',
    '工单当前工序': 'ขั้นตอนปัจจุบันของใบงาน',
    '超出可排产量,后端会拒绝(上限 = 可排产量 × 1.01)': 'เกินปริมาณที่จัดได้ เซิร์ฟเวอร์จะปฏิเสธ (สูงสุด = ปริมาณที่จัดได้ × 1.01)',
  },
}

let total = 0
for (const [loc, pairs] of Object.entries(ENTRIES)) {
  const file = path.join(LOCALES, `${loc}.js`)
  if (!fs.existsSync(file)) { console.log(`SKIP ${loc}`); continue }
  let src = fs.readFileSync(file, 'utf8')
  const add = []
  for (const [cn, tr] of Object.entries(pairs)) {
    const key = JSON.stringify(cn)
    if (src.includes(key + ':')) continue
    add.push(`    ${key}: ${JSON.stringify(tr)},`)
  }
  if (!add.length) { console.log(`SKIP ${loc}(已存在)`); continue }
  const idx = src.lastIndexOf('\n  },')
  if (idx < 0) { console.log(`FAIL ${loc}`); continue }
  src = src.slice(0, idx + 1) + add.join('\n') + '\n' + src.slice(idx + 1)
  fs.writeFileSync(file, src, 'utf8')
  total += add.length
  console.log(`OK ${loc}(+${add.length})`)
}
console.log(`DONE ${total}`)
