/**
 * _add-monthclose-i18n-2.cjs — 一次性脚本:补第二轮月结口径改动的 UI 词条(10 语言)
 *
 * 本轮(2026-10-15 用户第二次口径)新增/改名的中文原文:
 *   · 按钮改名:取消上月月结 → 取消月结(新增词条);
 *   · 展开区改成一张表:单据明细 / 期初数量 / 入库数量 / 出库数量 / 结存数量 / 最晚出库日期 / 该期间尚未月结,以下为期间内单据;
 *   · 左栏去掉搜索框后:查找仓库 已不用(保留旧词条不动),新增提示与确认文案。
 * 幂等:已存在的键自动跳过;插在既有 '库存明细': 词条之后。
 * 用法:node tools/archive/_stock-month-close/_add-monthclose-i18n-2.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const KEYS = [
  '取消月结', '单据明细', '期初数量', '入库数量', '出库数量', '结存数量', '最晚出库日期',
  '该期间尚未月结,以下为期间内单据', '会删除该期间的结转行,确定继续吗?', '经手人',
]

const TEXT = {
  en: ['Cancel Month Close', 'Document Detail', 'Opening Qty', 'Inbound Qty', 'Outbound Qty', 'Ending Qty', 'Last Outbound Date',
    'This period is not closed yet; documents of the period are listed below', 'This deletes the carry-forward rows of the period. Continue?', 'Handler'],
  ja: ['月次締めの取消', '伝票明細', '期初数量', '入庫数量', '出庫数量', '期末数量', '最終出庫日',
    'この期間は未締めです。以下は期間内の伝票です', 'この期間の繰越伝票行を削除します。続行しますか?', '担当者'],
  ko: ['월마감 취소', '전표 명세', '기초 수량', '입고 수량', '출고 수량', '기말 수량', '최종 출고일',
    '이 기간은 미마감입니다. 아래는 기간 내 전표입니다', '해당 기간의 이월 전표 행을 삭제합니다. 계속하시겠습니까?', '담당자'],
  'zh-TW': ['取消月結', '單據明細', '期初數量', '入庫數量', '出庫數量', '結存數量', '最晚出庫日期',
    '該期間尚未月結,以下為期間內單據', '會刪除該期間的結轉行,確定繼續嗎?', '經手人'],
  es: ['Cancelar cierre de mes', 'Detalle de documentos', 'Cantidad inicial', 'Cantidad de entrada', 'Cantidad de salida', 'Cantidad final', 'Última fecha de salida',
    'Este período aún no está cerrado; abajo se listan los documentos del período', 'Se eliminarán las líneas de arrastre del período. ¿Continuar?', 'Responsable'],
  fr: ['Annuler la clôture', 'Détail des documents', 'Quantité initiale', 'Quantité entrée', 'Quantité sortie', 'Quantité finale', 'Dernière date de sortie',
    'Cette période n’est pas clôturée ; les documents de la période sont listés ci-dessous', 'Les lignes de report de la période seront supprimées. Continuer ?', 'Responsable'],
  de: ['Abschluss aufheben', 'Belegdetails', 'Anfangsmenge', 'Zugangsmenge', 'Abgangsmenge', 'Endmenge', 'Letztes Abgangsdatum',
    'Diese Periode ist noch nicht abgeschlossen; unten stehen die Belege der Periode', 'Die Übertragszeilen der Periode werden gelöscht. Fortfahren?', 'Bearbeiter'],
  ru: ['Отменить закрытие месяца', 'Детали документов', 'Начальное количество', 'Количество прихода', 'Количество расхода', 'Конечное количество', 'Последняя дата расхода',
    'Период ещё не закрыт; ниже перечислены документы периода', 'Строки переноса периода будут удалены. Продолжить?', 'Исполнитель'],
  vi: ['Hủy kết chuyển tháng', 'Chi tiết chứng từ', 'Số lượng đầu kỳ', 'Số lượng nhập', 'Số lượng xuất', 'Số lượng cuối kỳ', 'Ngày xuất cuối cùng',
    'Kỳ này chưa kết chuyển; dưới đây là chứng từ trong kỳ', 'Sẽ xóa dòng kết chuyển của kỳ này. Tiếp tục?', 'Người lập'],
  th: ['ยกเลิกปิดบัญชีเดือน', 'รายละเอียดเอกสาร', 'จำนวนยกมา', 'จำนวนรับเข้า', 'จำนวนจ่ายออก', 'จำนวนคงเหลือ', 'วันที่จ่ายออกล่าสุด',
    'งวดนี้ยังไม่ปิดบัญชี ด้านล่างคือเอกสารในงวด', 'จะลบรายการยกยอดของงวดนี้ ดำเนินการต่อหรือไม่?', 'ผู้จัดทำ'],
}

let touched = 0
for (const [loc, texts] of Object.entries(TEXT)) {
  if (texts.length !== KEYS.length) throw new Error(`${loc} 词条数不一致`)
  const file = path.join(localesDir, `${loc}.js`)
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const missing = KEYS.filter((k, i) => texts[i] && !lines.some((l) => l.includes(`'${k}':`)))
  if (!missing.length) { console.log(`[skip] ${loc}.js 词条已齐`); continue }
  const anchor = lines.findIndex((l) => l.includes("'库存明细':"))
  if (anchor < 0) throw new Error(`${loc}.js 找不到锚点行 '库存明细'`)
  const indent = (lines[anchor].match(/^\s*/) || [''])[0]
  const added = KEYS.map((k, i) => (missing.includes(k) ? `${indent}'${k}': '${String(texts[i]).replace(/'/g, "\\'")}',` : null))
    .filter(Boolean)
  lines.splice(anchor + 1, 0, ...added)
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
  touched++
  console.log(`[ok] ${loc}.js 插入 ${added.length} 条`)
}
console.log(`完成:${touched}/${Object.keys(TEXT).length} 个语言文件被改写`)
