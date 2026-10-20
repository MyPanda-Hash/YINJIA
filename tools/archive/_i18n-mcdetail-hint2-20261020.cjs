/*
 * _i18n-mcdetail-hint2-20261020.cjs —— 口径提示改成「已月结 ⇒ 上月只显示月结」
 *
 * 原词条(2026-10-20 第一版):已月结:有结转行的批次只显示月结结转,月末结存为 0 的批次保留上月原始单据
 * 新词条(同日第二版,用户追问「月结不是全部月结吗,为什么部分有结转行部分没有」之后):
 *   已月结:上月只显示月结(月末结存为 0 的批次显示 0,不写结转行);上月原始单据请在库存台账按日期查看
 *
 * 用法: node tools/archive/_i18n-mcdetail-hint2-20261020.cjs [--apply]
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const LOCALES = path.join(ROOT, 'frontend', 'src', 'i18n', 'locales')
const OLD_KEY = '已月结:有结转行的批次只显示月结结转,月末结存为 0 的批次保留上月原始单据'
const NEW_KEY = '已月结:上月只显示月结(月末结存为 0 的批次显示 0,不写结转行);上月原始单据请在库存台账按日期查看'
const TEXT = {
  en: 'Closed: last month is represented by the closing row only (batches with a zero closing balance show 0 and have no carry-forward row); see the stock ledger by date for original documents',
  'zh-TW': '已月結:上月只顯示月結(月末結存為 0 的批次顯示 0,不寫結轉行);上月原始單據請在庫存台帳按日期查看',
  ja: '月次締め済:前月は繰越行のみ表示(月末残高 0 のロットは 0 表示・繰越行なし)。元伝票は在庫台帳を日付で確認',
  ko: '월 마감 완료: 전월은 이월 행만 표시(월말 잔액 0 로트는 0 표시·이월 행 없음). 원전표는 재고 대장에서 날짜로 확인',
  es: 'Cerrado: el mes anterior se representa solo con el asiento de traspaso (los lotes con saldo final 0 muestran 0 y no tienen asiento); consulte el libro de inventario por fecha para los documentos originales',
  fr: 'Clôturé : le mois précédent n’est représenté que par la ligne de report (lots à solde final nul : 0, sans ligne de report) ; voir le grand livre des stocks par date pour les pièces d’origine',
  de: 'Abgeschlossen: Der Vormonat wird nur durch die Vortragszeile dargestellt (Chargen mit Endbestand 0 zeigen 0, ohne Vortragszeile); Originalbelege im Lagerbuch nach Datum',
  ru: 'Закрыто: прошлый месяц представлен только строкой переноса (партии с нулевым остатком показывают 0, строки переноса нет); исходные документы — в книге склада по дате',
  vi: 'Đã kết chuyển: tháng trước chỉ thể hiện bằng dòng kết chuyển (lô có tồn cuối kỳ 0 hiển thị 0, không có dòng kết chuyển); xem sổ kho theo ngày cho chứng từ gốc',
  th: 'ปิดงบแล้ว: เดือนก่อนแสดงเฉพาะรายการยกยอด (ล็อตที่ยอดยกไปเป็น 0 แสดง 0 และไม่มีรายการยกยอด) ดูเอกสารเดิมได้ที่ทะเบียนคลังตามวันที่',
}

const apply = process.argv.includes('--apply')
let changed = 0
for (const [loc, text] of Object.entries(TEXT)) {
  const file = path.join(LOCALES, loc + '.js')
  let src = fs.readFileSync(file, 'utf8')
  if (src.includes(`'${NEW_KEY}'`)) { console.log(`[skip] ${loc}: 已是新词条`); continue }
  if (!src.includes(`'${OLD_KEY}'`)) { console.log(`[skip] ${loc}: 没找到旧词条`); continue }
  src = src.replace(`'${OLD_KEY}':`, `'${NEW_KEY}':`)
    .replace(new RegExp(`('${NEW_KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*)'[^']*'`, 'u'), (m, p1) => `${p1}'${text.replace(/'/g, "\\'")}'`)
  console.log(`[${apply ? 'apply' : 'dry'}] ${loc}`)
  if (apply) fs.writeFileSync(file, src, 'utf8')
  changed++
}
console.log(`\n${apply ? '已改写' : '将改写'} ${changed} 个语言包`)
