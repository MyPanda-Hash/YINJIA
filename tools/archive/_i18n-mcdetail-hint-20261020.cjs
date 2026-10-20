/*
 * _i18n-mcdetail-hint-20261020.cjs —— 一次性:库存明细展开区新增「月结后为什么还有上月单据」提示词条
 *
 * 背景(2026-10-20 用户报障「库存明细有问题,月结后为什么还会有 9 月份的单据」):
 *   修复后,上月已月结时**有结转行的批次只显示月结结转**;只有「月末结存为 0 的批次」(月结按口径
 *   不写结转行)才继续陈列出它上月的原始单据。界面上加一句提示,免得再被问一次。
 *
 * 用法: node tools/archive/_i18n-mcdetail-hint-20261020.cjs [--apply]
 *   插在 '上月未月结,以下陈列该月原始单据' 那一行之后(10 个语言包同一位置)。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const LOCALES = path.join(ROOT, 'frontend', 'src', 'i18n', 'locales')
const ANCHOR = "'上月未月结,以下陈列该月原始单据'"
const KEY = '已月结:有结转行的批次只显示月结结转,月末结存为 0 的批次保留上月原始单据'
const TEXT = {
  en: 'Closed: batches with a carry-forward row show only that row; batches whose closing balance was 0 keep their original documents',
  'zh-TW': '已月結:有結轉行的批次只顯示月結結轉,月末結存為 0 的批次保留上月原始單據',
  ja: '月次締め済:繰越行があるロットは繰越のみ表示、月末残高 0 のロットは前月の元伝票を表示',
  ko: '월 마감 완료: 이월 행이 있는 로트는 이월만 표시, 월말 잔액 0 로트는 전월 원전표 유지',
  es: 'Cerrado: los lotes con asiento de traspaso muestran solo ese asiento; los de saldo final 0 conservan sus documentos originales',
  fr: 'Clôturé : les lots avec une ligne de report affichent uniquement celle-ci ; les lots à solde final nul conservent leurs pièces d’origine',
  de: 'Abgeschlossen: Chargen mit Vortragszeile zeigen nur diese; Chargen mit Endbestand 0 behalten ihre Originalbelege',
  ru: 'Закрыто: партии со строкой переноса показывают только её; партии с нулевым конечным остатком сохраняют исходные документы',
  vi: 'Đã kết chuyển: lô có dòng kết chuyển chỉ hiển thị dòng đó; lô có tồn cuối kỳ bằng 0 vẫn giữ chứng từ gốc tháng trước',
  th: 'ปิดงบแล้ว: ล็อตที่มีรายการยกยอดจะแสดงเฉพาะรายการนั้น ล็อตที่ยอดยกไปเป็น 0 ยังคงแสดงเอกสารเดิมของเดือนก่อน',
}

const apply = process.argv.includes('--apply')
let changed = 0
for (const [loc, text] of Object.entries(TEXT)) {
  const file = path.join(LOCALES, loc + '.js')
  const src = fs.readFileSync(file, 'utf8')
  if (src.includes(`'${KEY}'`)) { console.log(`[skip] ${loc}: 已有该词条`); continue }
  const lines = src.split('\n')
  const i = lines.findIndex((l) => l.includes(ANCHOR))
  if (i < 0) { console.log(`[skip] ${loc}: 没找到锚点行`); continue }
  const indent = (lines[i].match(/^\s*/) || [''])[0]
  lines.splice(i + 1, 0, `${indent}'${KEY}': '${text.replace(/'/g, "\\'")}',`)
  console.log(`[${apply ? 'apply' : 'dry'}] ${loc}: +1 行(第 ${i + 2} 行)`)
  if (apply) fs.writeFileSync(file, lines.join('\n'), 'utf8')
  changed++
}
console.log(`\n${apply ? '已写入' : '将写入'} ${changed} 个语言包`)
