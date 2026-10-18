#!/usr/bin/env node
/**
 * 一次性:给 9 个非英文语言包补「结案异常」两个词条(2026-10-18)。
 * 幂等:已存在 '结案异常' 的文件跳过。用法: node tools/archive/_diag-scan-report/_add-i18n-close-anomaly.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'frontend/src/i18n/locales'
const TIP = '该行已结案，但不满足 MES 的结案条件（入库≥排产 + 组装成品检验已审核）—— 通常是手机端小程序/参考库直连写库造成的，可用「结案体检」核对后回正'
const T = {
  'zh-TW': ['結案異常', '該行已結案，但不符 MES 的結案條件（入庫≥排產 + 組裝成品檢驗已審核）—— 通常是手機端小程式/參考庫直連寫庫造成的，可用「結案體檢」核對後回正'],
  ja: ['結案異常', 'この行は結案済みですが、MES の結案条件（入庫≥計画数 + 組立完成品検査の承認）を満たしていません。多くはスマホ側ミニプログラム/参照システムが DB へ直接書き込んだためです。「結案チェック」で確認して戻してください。'],
  ko: ['마감 이상', '이 행은 마감되었지만 MES 마감 조건(입고≥생산계획 + 조립 완제품 검사 승인)을 충족하지 않습니다. 대개 모바일 미니프로그램/참조 시스템이 DB에 직접 쓴 결과입니다. 「마감 점검」으로 확인 후 되돌리십시오.'],
  ru: ['Аномалия закрытия', 'Строка закрыта, но не выполняет условие закрытия MES (приход ≥ план + утверждённая инспекция готовой продукции сборки) — обычно это прямой запрос в БД из мини-программы/старой системы. Проверьте через «Аудит закрытия» и откатите.'],
  es: ['Cierre anómalo', 'Esta línea está cerrada pero no cumple la regla de cierre de MES (entrada ≥ planificado + inspección de producto terminado de ensamble aprobada) — normalmente lo causa el mini-programa/legacy escribiendo directo en la base. Revíselo con «Auditoría de cierre» y corríjalo.'],
  fr: ['Clôture anormale', 'Cette ligne est clôturée mais ne respecte pas la règle de clôture MES (entrée ≥ planifié + inspection produit fini assemblage approuvée) — généralement dû au mini-programme/système hérité écrivant directement en base. Vérifiez via « Audit de clôture » puis corrigez.'],
  de: ['Anomaler Abschluss', 'Die Zeile ist abgeschlossen, erfüllt aber die MES-Abschlussregel nicht (Zugang ≥ geplant + freigegebene Fertigwarenprüfung Montage) — meist durch direkte DB-Schreibzugriffe des Mini-Programms/Altysstems. Mit „Abschluss-Prüfung“ kontrollieren und zurücksetzen.'],
  th: ['ปิดงานผิดปกติ', 'บรรทัดนี้ปิดงานแล้วแต่ไม่ตรงเงื่อนไขการปิดงานของ MES (รับเข้า≥แผนผลิต + ผลตรวจสินค้าสำเร็จรูปประกอบได้รับการอนุมัติ) — มักเกิดจากมินิโปรแกรม/ระบบเดิมเขียนฐานข้อมูลโดยตรง ตรวจสอบด้วย「ตรวจการปิดงาน」แล้วแก้กลับ'],
  vi: ['Đóng lệnh bất thường', 'Dòng này đã đóng nhưng không thỏa điều kiện đóng của MES (nhập kho ≥ kế hoạch + phiếu kiểm thành phẩm lắp ráp đã duyệt) — thường do mini-program/hệ thống cũ ghi trực tiếp vào CSDL. Kiểm tra bằng «Rà soát đóng lệnh» rồi sửa lại.'],
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
let changed = 0
for (const [loc, [short, tip]] of Object.entries(T)) {
  const file = path.join(DIR, `${loc}.js`)
  if (!fs.existsSync(file)) { console.log('跳过(不存在)', file); continue }
  let s = fs.readFileSync(file, 'utf8')
  if (s.includes("'结案异常'")) { console.log('已有,跳过', loc); continue }
  const m = s.match(/biz: \{[ \t]*(\r?\n)/)
  if (!m) { console.log('找不到 biz 锚点,跳过', loc); continue }
  const eol = m[1] === '\r\n' ? '\r\n' : '\n'
  const at = m.index + m[0].length
  const nl = (n) => eol + '    ' + n
  const block = `    // 结案异常(2026-10-18):ja 可由外部程序直写,后端按 MES 结案口径反查后标出来`
    + nl(`'结案异常': '${esc(short)}',`)
    + nl(`'${esc(TIP)}': '${esc(tip)}',`)
  s = s.slice(0, at) + block + s.slice(at)
  fs.writeFileSync(file, s, 'utf8')
  changed++
  console.log('已补', loc)
}
console.log('共改', changed, '个文件')
