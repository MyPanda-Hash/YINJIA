/**
 * _add-monthclose-i18n.cjs — 一次性脚本:给 10 个语言文件补「库存月结 + 分仓库选择 + 展开明细」的 UI 词条
 *
 * 背景(AGENTS.md 多语言强制规范):本批新增了三个按钮、左侧分仓库列表与行展开明细区,
 *   显示层全部走 tt(),译名必须同批交付。已有的中文标签(数量/单价/单据日期/单据编号/确定/取消…)
 *   由既有词条覆盖,这里只补**新增**的中文原文;已存在的键自动跳过(幂等)。
 * 挂靠位置:统一插在既有的 `'库存明细':` 词条后面(与本批功能同族,便于人工核对)。
 * 用法:node tools/archive/_stock-month-close/_add-monthclose-i18n.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

/** 新增词条:键 = 中文原文(tt 的入参),值 = 各语言译名 */
const KEYS = [
  '上月月结', '取消上月月结', '重新月结',
  '库存月结明细', '期间状态', '本月入库', '本月出库', '结转行',
  '展开加载中', '加载月结明细失败', '该期间尚未月结',
  '分仓库', '查找仓库', '共有数据', '全不选', '条',
  '会重算结转行与库存余量,确定继续吗?',
  '按钮执行失败', '期间', '键数', '结存合计',
]

const TEXT = {
  en: ['Close Last Month', 'Cancel Last Month Close', 'Re-close Month',
    'Stock Month-Close Detail', 'Period Status', 'This Month Inbound', 'This Month Outbound', 'Carry-forward Row',
    'Loading', 'Failed to load month-close detail', 'Period not closed yet',
    'By Warehouse', 'Search warehouse', 'Records', 'Clear all', 'rows',
    'This recalculates carry-forward rows and on-hand quantity. Continue?',
    'Action failed', 'Period', 'Keys', 'Ending Balance'],
  ja: ['前月月次締め', '前月締めの取消', '月次再締め',
    '在庫月次締め明細', '期間状態', '当月入庫', '当月出庫', '繰越伝票行',
    '読み込み中', '月次締め明細の取得に失敗', 'この期間は未締めです',
    '倉庫別', '倉庫検索', 'データ件数', '全解除', '件',
    '繰越伝票行と在庫残高を再計算します。続行しますか?',
    'ボタンの実行に失敗', '期間', '件数', '期末残高'],
  ko: ['전월 마감', '전월 마감 취소', '월 재마감',
    '재고 월마감 명세', '기간 상태', '당월 입고', '당월 출고', '이월 전표 행',
    '불러오는 중', '월마감 명세 로드 실패', '해당 기간은 미마감입니다',
    '창고별', '창고 검색', '데이터 건수', '전체 해제', '건',
    '이월 전표 행과 재고 수량을 재계산합니다. 계속하시겠습니까?',
    '버튼 실행 실패', '기간', '건수', '기말 잔액'],
  'zh-TW': ['上月月結', '取消上月月結', '重新月結',
    '庫存月結明細', '期間狀態', '本月入庫', '本月出庫', '結轉行',
    '展開載入中', '載入月結明細失敗', '該期間尚未月結',
    '分倉庫', '查找倉庫', '共有資料', '全不選', '筆',
    '會重算結轉行與庫存餘量,確定繼續嗎?',
    '按鈕執行失敗', '期間', '鍵數', '結存合計'],
  es: ['Cerrar mes anterior', 'Cancelar cierre del mes anterior', 'Rehacer cierre',
    'Detalle del cierre mensual de inventario', 'Estado del período', 'Entradas del mes', 'Salidas del mes', 'Línea de arrastre',
    'Cargando', 'No se pudo cargar el detalle del cierre', 'Período aún no cerrado',
    'Por almacén', 'Buscar almacén', 'Registros', 'Quitar todo', 'registros',
    'Se recalcularán las líneas de arrastre y el inventario. ¿Continuar?',
    'Error al ejecutar la acción', 'Período', 'Claves', 'Saldo final'],
  fr: ['Clôturer le mois précédent', 'Annuler la clôture du mois précédent', 'Refaire la clôture',
    'Détail de clôture mensuelle du stock', 'État de la période', 'Entrées du mois', 'Sorties du mois', 'Ligne de report',
    'Chargement', 'Échec du chargement du détail de clôture', 'Période non clôturée',
    'Par entrepôt', 'Rechercher un entrepôt', 'Enregistrements', 'Tout décocher', 'lignes',
    'Les lignes de report et le stock seront recalculés. Continuer ?',
    'Échec de l’action', 'Période', 'Clés', 'Solde final'],
  de: ['Vormonat abschließen', 'Vormonatsabschluss aufheben', 'Abschluss wiederholen',
    'Bestands-Monatsabschluss-Details', 'Periodenstatus', 'Zugänge des Monats', 'Abgänge des Monats', 'Übertragszeile',
    'Wird geladen', 'Abschlussdetails konnten nicht geladen werden', 'Periode noch nicht abgeschlossen',
    'Nach Lager', 'Lager suchen', 'Datensätze', 'Alle abwählen', 'Zeilen',
    'Übertragszeilen und Bestand werden neu berechnet. Fortfahren?',
    'Aktion fehlgeschlagen', 'Periode', 'Schlüssel', 'Endbestand'],
  ru: ['Закрыть прошлый месяц', 'Отменить закрытие прошлого месяца', 'Перезакрыть месяц',
    'Детали месячного закрытия запасов', 'Статус периода', 'Приход за месяц', 'Расход за месяц', 'Строка переноса',
    'Загрузка', 'Не удалось загрузить детали закрытия', 'Период ещё не закрыт',
    'По складам', 'Поиск склада', 'Записей', 'Снять всё', 'строк',
    'Строки переноса и остатки будут пересчитаны. Продолжить?',
    'Не удалось выполнить действие', 'Период', 'Ключей', 'Конечный остаток'],
  vi: ['Kết chuyển tháng trước', 'Hủy kết chuyển tháng trước', 'Kết chuyển lại',
    'Chi tiết kết chuyển tồn kho', 'Trạng thái kỳ', 'Nhập trong tháng', 'Xuất trong tháng', 'Dòng kết chuyển',
    'Đang tải', 'Tải chi tiết kết chuyển thất bại', 'Kỳ này chưa kết chuyển',
    'Theo kho', 'Tìm kho', 'Số bản ghi', 'Bỏ chọn tất cả', 'dòng',
    'Sẽ tính lại dòng kết chuyển và tồn kho. Tiếp tục?',
    'Thực hiện thất bại', 'Kỳ', 'Số khóa', 'Tồn cuối kỳ'],
  th: ['ปิดบัญชีเดือนก่อน', 'ยกเลิกปิดบัญชีเดือนก่อน', 'ปิดบัญชีใหม่',
    'รายละเอียดปิดบัญชีสต๊อกรายเดือน', 'สถานะงวด', 'รับเข้าเดือนนี้', 'จ่ายออกเดือนนี้', 'รายการยกยอด',
    'กำลังโหลด', 'โหลดรายละเอียดปิดบัญชีไม่สำเร็จ', 'งวดนี้ยังไม่ปิดบัญชี',
    'แยกตามคลัง', 'ค้นหาคลัง', 'จำนวนข้อมูล', 'ยกเลิกทั้งหมด', 'รายการ',
    'ระบบจะคำนวณรายการยกยอดและจำนวนคงเหลือใหม่ ดำเนินการต่อหรือไม่?',
    'ดำเนินการไม่สำเร็จ', 'งวด', 'จำนวนคีย์', 'ยอดคงเหลือปลายงวด'],
}

let touched = 0
for (const [loc, texts] of Object.entries(TEXT)) {
  if (texts.length !== KEYS.length) throw new Error(`${loc} 词条数与 KEYS 不一致(${texts.length} vs ${KEYS.length})`)
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
