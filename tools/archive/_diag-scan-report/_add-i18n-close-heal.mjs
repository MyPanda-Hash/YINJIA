#!/usr/bin/env node
/**
 * 一次性:给 10 个语言包补「结案回正」按钮相关词条(2026-10-18)。
 * 幂等:已存在 '结案回正' 的文件跳过。用法: node tools/archive/_diag-scan-report/_add-i18n-close-heal.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'frontend/src/i18n/locales'
const P_ASK = '把外部程序误写成「已结案」的工单改回未结案'
const T = {
  en: {
    heal: 'Reopen closed',
    none: 'No work orders need reopening',
    ask: P_ASK,
    askTr: 'Reopen work orders that external programs wrongly marked closed',
    done: 'Reopened',
    row: 'row(s)',
  },
  'zh-TW': { heal: '結案回正', none: '沒有需要回正的結案行', askTr: '把外部程式誤寫成「已結案」的工單改回未結案', done: '已回正', row: '行' },
  ja: { heal: '結案回正', none: '回正が必要な結案行はありません', askTr: '外部プログラムが誤って「結案」にした工単を未結案に戻す', done: '回正済み', row: '行' },
  ko: { heal: '마감 되돌리기', none: '되돌릴 마감 행이 없습니다', askTr: '외부 프로그램이 잘못 마감한 작업지시를 미마감으로 되돌립니다', done: '되돌림', row: '행' },
  ru: { heal: 'Откат закрытия', none: 'Нет строк для отката', askTr: 'Вернуть в незакрытые наряды, ошибочно закрытые внешней программой', done: 'Откатано', row: 'стр.' },
  es: { heal: 'Revertir cierre', none: 'No hay órdenes por revertir', askTr: 'Reabrir órdenes marcadas como cerradas por error por un programa externo', done: 'Revertidas', row: 'fila(s)' },
  fr: { heal: 'Annuler clôture', none: 'Aucun ordre à rouvrir', askTr: "Rouvrir les ordres clôturés à tort par un programme externe", done: 'Rouverts', row: 'ligne(s)' },
  de: { heal: 'Abschluss zurücksetzen', none: 'Keine Aufträge zum Zurücksetzen', askTr: 'Aufträge wieder öffnen, die ein externes Programm fälschlich abgeschlossen hat', done: 'Zurückgesetzt', row: 'Zeile(n)' },
  th: { heal: 'แก้การปิดงาน', none: 'ไม่มีรายการที่ต้องแก้', askTr: 'เปิดงานที่โปรแกรมภายนอกปิดผิดกลับเป็นยังไม่ปิด', done: 'แก้แล้ว', row: 'รายการ' },
  vi: { heal: 'Hoàn tác đóng lệnh', none: 'Không có lệnh nào cần hoàn tác', askTr: 'Mở lại các lệnh bị chương trình ngoài đóng nhầm', done: 'Đã hoàn tác', row: 'dòng' },
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
let changed = 0
for (const [loc, t] of Object.entries(T)) {
  const file = path.join(DIR, `${loc}.js`)
  if (!fs.existsSync(file)) { console.log('跳过(不存在)', file); continue }
  let s = fs.readFileSync(file, 'utf8')
  if (s.includes("'结案回正'")) { console.log('已有,跳过', loc); continue }
  const m = s.match(/biz: \{[ \t]*(\r?\n)/)
  if (!m) { console.log('找不到 biz 锚点,跳过', loc); continue }
  const eol = m[1] === '\r\n' ? '\r\n' : '\n'
  const at = m.index + m[0].length
  const nl = (n) => eol + '    ' + n
  const block = `    // 结案回正(2026-10-18):外部程序直连库误写已结案时的恢复入口`
    + nl(`'结案回正': '${esc(t.heal)}',`)
    + nl(`'没有需要回正的结案行': '${esc(t.none)}',`)
    + nl(`'${esc(P_ASK)}': '${esc(t.askTr)}',`)
    + nl(`'已回正': '${esc(t.done)}',`)
    + nl(`'行': '${esc(t.row)}',`)
  s = s.slice(0, at) + block + s.slice(at)
  fs.writeFileSync(file, s, 'utf8')
  changed++
  console.log('已补', loc)
}
console.log('共改', changed, '个文件')
