import fs from 'node:fs'

/**
 * _i18n-docrail-ui.mjs — 左「单据选择」栏 + 翻页条的全部显示文案(2026-10-21)
 *
 * 背景:三张工序检验单(制程/首件/组装成品)接入左目录后,切到 en/ja 时这一栏是**半中文**:
 *   `Total records: 447 条`、列头 `["单号","日付","製造指図番号","製品名","审核状态"]`。
 *
 * 根因不是"漏翻",而是**这栏从来没进过静态语言包** —— 它一直靠 tt() 未命中 → 后端机翻兜底:
 *   · `yj_translation` 里只有 工单号/产品名称/日期(它们是 yj_field 标签,9 语言齐全)能被后端词典直接命中;
 *   · 单号 / 审核状态 / 共有数据 / 查找 / 模糊搜索 / 暂无数据 / 收起 / 上一页… 一条都没有 ⇒ 机翻可用时勉强,
 *     本机 backend/.env 缺失(机翻降级)时就**原样吐中文**。
 *
 * 本脚本把这一栏(含 DocRailPager 翻页条)的**全部**文案一次性写进 10 个静态语言包(幂等,已有则跳过),
 * 让它在任何语言下都不再依赖机翻。锚点 = 各语言包首件检验那批的「只列未完工的工单行…」行。
 */
const ANCHOR = '    "只列未完工的工单行；已完工、已结案或已有首件检验单的工单行不再列出。":'

/** 键 = 模板里的中文原文(含占位符),值 = 各语言译文 */
const BLOCKS = {
  'zh-TW': {
    单号: '單號', 日期: '日期', 工单号: '工單號', 产品名称: '產品名稱', 审核状态: '審核狀態',
    查找: '查詢', 模糊搜索: '模糊搜尋', 暂无数据: '暫無資料', 收起: '收合', 拖动调整宽度: '拖曳調整寬度',
    上一页: '上一頁', 下一页: '下一頁', 首页: '首頁', 末页: '末頁',
    '第 {p}/{n} 页': '第 {p}/{n} 頁', '共有数据: {n} 条': '共有資料: {n} 筆',
  },
  en: {
    单号: 'No.', 日期: 'Date', 工单号: 'Work Order No.', 产品名称: 'Product Name', 审核状态: 'Audit Status',
    查找: 'Find', 模糊搜索: 'Fuzzy search', 暂无数据: 'No data', 收起: 'Collapse', 拖动调整宽度: 'Drag to resize',
    上一页: 'Prev', 下一页: 'Next', 首页: 'First', 末页: 'Last',
    '第 {p}/{n} 页': 'Page {p}/{n}', '共有数据: {n} 条': 'Total: {n}',
  },
  ja: {
    单号: '伝票番号', 日期: '日付', 工单号: '製造指図番号', 产品名称: '製品名', 审核状态: '承認状態',
    查找: '検索', 模糊搜索: 'あいまい検索', 暂无数据: 'データなし', 收起: '折りたたむ', 拖动调整宽度: 'ドラッグで幅を調整',
    上一页: '前へ', 下一页: '次へ', 首页: '先頭', 末页: '末尾',
    '第 {p}/{n} 页': '{p}/{n} ページ', '共有数据: {n} 条': '全件数: {n} 件',
  },
  ko: {
    单号: '번호', 日期: '날짜', 工单号: '작업지시 번호', 产品名称: '제품명', 审核状态: '승인 상태',
    查找: '검색', 模糊搜索: '모호 검색', 暂无数据: '데이터 없음', 收起: '접기', 拖动调整宽度: '드래그하여 너비 조정',
    上一页: '이전', 下一页: '다음', 首页: '처음', 末页: '마지막',
    '第 {p}/{n} 页': '{p}/{n} 페이지', '共有数据: {n} 条': '전체: {n} 건',
  },
  es: {
    单号: 'N.º', 日期: 'Fecha', 工单号: 'N.º de orden', 产品名称: 'Nombre del producto', 审核状态: 'Estado de auditoría',
    查找: 'Buscar', 模糊搜索: 'Búsqueda difusa', 暂无数据: 'Sin datos', 收起: 'Contraer', 拖动调整宽度: 'Arrastrar para ajustar el ancho',
    上一页: 'Anterior', 下一页: 'Siguiente', 首页: 'Primera', 末页: 'Última',
    '第 {p}/{n} 页': 'Página {p}/{n}', '共有数据: {n} 条': 'Total: {n}',
  },
  fr: {
    单号: 'N°', 日期: 'Date', 工单号: "N° d'ordre", 产品名称: 'Nom du produit', 审核状态: "État d'audit",
    查找: 'Rechercher', 模糊搜索: 'Recherche floue', 暂无数据: 'Aucune donnée', 收起: 'Réduire', 拖动调整宽度: 'Glisser pour redimensionner',
    上一页: 'Précédent', 下一页: 'Suivant', 首页: 'Première', 末页: 'Dernière',
    '第 {p}/{n} 页': 'Page {p}/{n}', '共有数据: {n} 条': 'Total : {n}',
  },
  de: {
    单号: 'Nr.', 日期: 'Datum', 工单号: 'Auftrags-Nr.', 产品名称: 'Produktname', 审核状态: 'Prüfstatus',
    查找: 'Suchen', 模糊搜索: 'Unscharfe Suche', 暂无数据: 'Keine Daten', 收起: 'Einklappen', 拖动调整宽度: 'Ziehen zum Anpassen der Breite',
    上一页: 'Zurück', 下一页: 'Weiter', 首页: 'Erste', 末页: 'Letzte',
    '第 {p}/{n} 页': 'Seite {p}/{n}', '共有数据: {n} 条': 'Gesamt: {n}',
  },
  ru: {
    单号: '№', 日期: 'Дата', 工单号: '№ заказа', 产品名称: 'Наименование продукта', 审核状态: 'Статус проверки',
    查找: 'Найти', 模糊搜索: 'Нечёткий поиск', 暂无数据: 'Нет данных', 收起: 'Свернуть', 拖动调整宽度: 'Перетащите, чтобы изменить ширину',
    上一页: 'Назад', 下一页: 'Вперёд', 首页: 'Первая', 末页: 'Последняя',
    '第 {p}/{n} 页': 'Стр. {p}/{n}', '共有数据: {n} 条': 'Всего: {n}',
  },
  vi: {
    单号: 'Số', 日期: 'Ngày', 工单号: 'Số lệnh sản xuất', 产品名称: 'Tên sản phẩm', 审核状态: 'Trạng thái duyệt',
    查找: 'Tìm', 模糊搜索: 'Tìm mờ', 暂无数据: 'Không có dữ liệu', 收起: 'Thu gọn', 拖动调整宽度: 'Kéo để điều chỉnh độ rộng',
    上一页: 'Trước', 下一页: 'Sau', 首页: 'Đầu', 末页: 'Cuối',
    '第 {p}/{n} 页': 'Trang {p}/{n}', '共有数据: {n} 条': 'Tổng số: {n}',
  },
  th: {
    单号: 'เลขที่', 日期: 'วันที่', 工单号: 'เลขที่ใบสั่งผลิต', 产品名称: 'ชื่อผลิตภัณฑ์', 审核状态: 'สถานะอนุมัติ',
    查找: 'ค้นหา', 模糊搜索: 'ค้นหาแบบคลุมเครือ', 暂无数据: 'ไม่มีข้อมูล', 收起: 'ย่อ', 拖动调整宽度: 'ลากเพื่อปรับความกว้าง',
    上一页: 'ก่อนหน้า', 下一页: 'ถัดไป', 首页: 'หน้าแรก', 末页: 'หน้าสุดท้าย',
    '第 {p}/{n} 页': 'หน้า {p}/{n}', '共有数据: {n} 条': 'ทั้งหมด: {n} รายการ',
  },
}

let files = 0
let added = 0
for (const [loc, block] of Object.entries(BLOCKS)) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  let s = fs.readFileSync(p, 'utf8')
  const i = s.indexOf(ANCHOR)
  if (i < 0) { console.log(`SKIP ${loc}: 锚点缺失`); continue }
  const missing = Object.entries(block).filter(([k]) => !s.includes(JSON.stringify(k) + ':'))
  if (!missing.length) { console.log(`SKIP ${loc}: 已全部存在`); continue }
  const add = missing.map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')
  s = s.slice(0, i) + add + '\n' + s.slice(i)
  fs.writeFileSync(p, s, 'utf8')
  files++
  added += missing.length
  console.log(`OK   ${loc}: +${missing.length} 条`)
}
console.log(`\n共 ${files} 个语言包 / ${added} 条词条`)
