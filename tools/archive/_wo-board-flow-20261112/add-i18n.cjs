#!/usr/bin/env node
/**
 * 工单排产「按量流转」展示列的多语言词条（2026-11-12，方案A 只读展示）。
 * 幂等：已存在的键跳过；插在各 locale 的 biz 块末尾。
 * 用法：node tools/archive/_wo-board-flow-20261112/add-i18n.cjs
 */
const fs = require('fs')
const path = require('path')

const LOCALES = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const ENTRIES = {
  en: {
    '上道完工(折成品)': 'Upstream Output (Converted)',
    '待报量': 'Reportable Remaining',
    '待流入量': 'Pending Inflow',
    '上道完工(折成品) = 上一道已审报工 ÷ 上一道换算率;首道 = 排产数量': 'Upstream output (converted) = approved output of the previous process / its conversion rate; first process = scheduled qty',
    '可加工量 = 上道完工(折成品) × 本工序换算率(本道现在最多能做多少)': 'Processable qty = upstream output (converted) x this process conversion rate',
    '待报量 = 可加工量 − 本工序已审报工(本道还能报多少)': 'Reportable remaining = processable qty - approved output of this process',
    '待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)': 'Pending inflow = planned qty - processable qty (still to flow in from the previous process)',
  },
  'zh-TW': {
    '上道完工(折成品)': '上道完工(折成品)',
    '待报量': '待報量',
    '待流入量': '待流入量',
    '上道完工(折成品) = 上一道已审报工 ÷ 上一道换算率;首道 = 排产数量': '上道完工(折成品) = 上一道已審報工 ÷ 上一道換算率;首道 = 排產數量',
    '可加工量 = 上道完工(折成品) × 本工序换算率(本道现在最多能做多少)': '可加工量 = 上道完工(折成品) × 本工序換算率(本道現在最多能做多少)',
    '待报量 = 可加工量 − 本工序已审报工(本道还能报多少)': '待報量 = 可加工量 − 本工序已審報工(本道還能報多少)',
    '待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)': '待流入量 = 本工序計劃量 − 可加工量(還等上一道流下來多少)',
  },
  ja: {
    '上道完工(折成品)': '前工程完工(換算後)',
    '待报量': '報告残',
    '待流入量': '流入待ち',
    '上道完工(折成品) = 上一道已审报工 ÷ 上一道换算率;首道 = 排产数量': '前工程完工(換算後) = 前工程の承認済み完成量 ÷ 前工程換算率;最初の工程 = 計画数量',
    '可加工量 = 上道完工(折成品) × 本工序换算率(本道现在最多能做多少)': '加工可能量 = 前工程完工(換算後) × 本工程換算率',
    '待报量 = 可加工量 − 本工序已审报工(本道还能报多少)': '報告残 = 加工可能量 − 本工程の承認済み完成量',
    '待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)': '流入待ち = 本工程の計画数量 − 加工可能量(前工程からの流入待ち)',
  },
  ko: {
    '上道完工(折成品)': '이전 공정 완료(환산)',
    '待报量': '보고 가능 잔량',
    '待流入量': '입고 대기량',
    '上道完工(折成品) = 上一道已审报工 ÷ 上一道换算率;首道 = 排产数量': '이전 공정 완료(환산) = 이전 공정 승인 완료량 ÷ 이전 공정 환산율; 첫 공정 = 계획 수량',
    '可加工量 = 上道完工(折成品) × 本工序换算率(本道现在最多能做多少)': '가공 가능량 = 이전 공정 완료(환산) × 본 공정 환산율',
    '待报量 = 可加工量 − 本工序已审报工(本道还能报多少)': '보고 가능 잔량 = 가공 가능량 − 본 공정 승인 완료량',
    '待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)': '입고 대기량 = 본 공정 계획 수량 − 가공 가능량',
  },
  de: {
    '上道完工(折成品)': 'Vorgang-Ausbringung (umgerechnet)',
    '待报量': 'Noch meldbar',
    '待流入量': 'Zugang ausstehend',
    '上道完工(折成品) = 上一道已审报工 ÷ 上一道换算率;首道 = 排产数量': 'Vorgang-Ausbringung (umgerechnet) = freigegebene Menge des Vorgangs / Umrechnungsfaktor; erster Vorgang = Planmenge',
    '可加工量 = 上道完工(折成品) × 本工序换算率(本道现在最多能做多少)': 'Bearbeitbare Menge = Vorgang-Ausbringung (umgerechnet) x Umrechnungsfaktor',
    '待报量 = 可加工量 − 本工序已审报工(本道还能报多少)': 'Noch meldbar = bearbeitbare Menge - freigegebene Menge dieses Vorgangs',
    '待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)': 'Zugang ausstehend = Planmenge - bearbeitbare Menge',
  },
  es: {
    '上道完工(折成品)': 'Producción anterior (convertida)',
    '待报量': 'Pendiente de reportar',
    '待流入量': 'Entrada pendiente',
    '上道完工(折成品) = 上一道已审报工 ÷ 上一道换算率;首道 = 排产数量': 'Producción anterior (convertida) = producción aprobada del proceso anterior / su factor; primer proceso = cantidad planificada',
    '可加工量 = 上道完工(折成品) × 本工序换算率(本道现在最多能做多少)': 'Cantidad procesable = producción anterior (convertida) x factor de este proceso',
    '待报量 = 可加工量 − 本工序已审报工(本道还能报多少)': 'Pendiente de reportar = cantidad procesable - producción aprobada de este proceso',
    '待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)': 'Entrada pendiente = cantidad planificada - cantidad procesable',
  },
  fr: {
    '上道完工(折成品)': "Production amont (convertie)",
    '待报量': 'Reste à déclarer',
    '待流入量': 'Entrée en attente',
    '上道完工(折成品) = 上一道已审报工 ÷ 上一道换算率;首道 = 排产数量': "Production amont (convertie) = production approuvée de l'opération précédente / son taux; première opération = quantité planifiée",
    '可加工量 = 上道完工(折成品) × 本工序换算率(本道现在最多能做多少)': 'Quantité traitable = production amont (convertie) x taux de cette opération',
    '待报量 = 可加工量 − 本工序已审报工(本道还能报多少)': 'Reste à déclarer = quantité traitable - production approuvée de cette opération',
    '待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)': 'Entrée en attente = quantité planifiée - quantité traitable',
  },
  ru: {
    '上道完工(折成品)': 'Выпуск предыдущей операции (в пересчёте)',
    '待报量': 'Остаток к отчёту',
    '待流入量': 'Ожидается поступление',
    '上道完工(折成品) = 上一道已审报工 ÷ 上一道换算率;首道 = 排产数量': 'Выпуск предыдущей операции (в пересчёте) = подтверждённый выпуск / коэффициент; первая операция = плановое количество',
    '可加工量 = 上道完工(折成品) × 本工序换算率(本道现在最多能做多少)': 'Обрабатываемое количество = выпуск предыдущей операции (в пересчёте) × коэффициент этой операции',
    '待报量 = 可加工量 − 本工序已审报工(本道还能报多少)': 'Остаток к отчёту = обрабатываемое количество − подтверждённый выпуск этой операции',
    '待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)': 'Ожидается поступление = плановое количество − обрабатываемое количество',
  },
  vi: {
    '上道完工(折成品)': 'Công đoạn trước hoàn thành (quy đổi)',
    '待报量': 'Còn có thể báo cáo',
    '待流入量': 'Chờ chuyển vào',
    '上道完工(折成品) = 上一道已审报工 ÷ 上一道换算率;首道 = 排产数量': 'Công đoạn trước hoàn thành (quy đổi) = SL đã duyệt của công đoạn trước ÷ hệ số quy đổi; công đoạn đầu = SL kế hoạch',
    '可加工量 = 上道完工(折成品) × 本工序换算率(本道现在最多能做多少)': 'SL có thể gia công = công đoạn trước hoàn thành (quy đổi) × hệ số công đoạn này',
    '待报量 = 可加工量 − 本工序已审报工(本道还能报多少)': 'Còn có thể báo cáo = SL có thể gia công − SL đã duyệt của công đoạn này',
    '待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)': 'Chờ chuyển vào = SL kế hoạch − SL có thể gia công',
  },
  th: {
    '上道完工(折成品)': 'ขั้นตอนก่อนหน้าเสร็จ (แปลงหน่วย)',
    '待报量': 'คงเหลือที่รายงานได้',
    '待流入量': 'รอการโอนเข้า',
    '上道完工(折成品) = 上一道已审报工 ÷ 上一道换算率;首道 = 排产数量': 'ขั้นตอนก่อนหน้าเสร็จ (แปลงหน่วย) = ปริมาณที่อนุมัติของขั้นตอนก่อนหน้า ÷ อัตราแปลง; ขั้นตอนแรก = ปริมาณตามแผน',
    '可加工量 = 上道完工(折成品) × 本工序换算率(本道现在最多能做多少)': 'ปริมาณที่ทำได้ = ขั้นตอนก่อนหน้าเสร็จ (แปลงหน่วย) × อัตราแปลงของขั้นตอนนี้',
    '待报量 = 可加工量 − 本工序已审报工(本道还能报多少)': 'คงเหลือที่รายงานได้ = ปริมาณที่ทำได้ − ปริมาณที่อนุมัติของขั้นตอนนี้',
    '待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)': 'รอการโอนเข้า = ปริมาณตามแผน − ปริมาณที่ทำได้',
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
console.log(`DONE 共写入 ${total} 条`)
