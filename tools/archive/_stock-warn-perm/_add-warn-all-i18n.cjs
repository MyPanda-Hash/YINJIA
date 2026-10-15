/**
 * _add-warn-all-i18n.cjs — 「库存明细·统一预警」词条(10 语言)
 *
 * 背景(用户 2026-10-15 当日新口径):
 *   「只要库存明细可以写就行,库存状况不需要,而且库存明细的预警要可以统一设置,再单独设置。」
 * 前端 PanelxList.vue 库存明细展开区新增「统一预警」输入框 + 应用按钮(POST /api/stock/warn/setAll),
 * 按仓库规范(AGENTS.md §多语言强制规范)显示层一律走 tt(),故新增词条必须同时进 locales 的 biz 词表,
 * 否则切到英语/日语后新入口仍显示中文。
 *
 * 用法:node tools/archive/_stock-warn-perm/_add-warn-all-i18n.cjs
 * 幂等:已存在 '中文词条': 行则跳过该词条;锚点 = '库存明细': 行之后(与月结/预警配置词条同段)。
 */
const fs = require('node:fs')
const path = require('node:path')
const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const KEYS = [
  '统一预警',
  '应用',
  '对本物料本仓库的所有批次统一设置',
  '请填写预警数量',
  '已对全部批次统一设置预警数量',
  '统一设置预警数量失败',
]

/** 每种语言按 KEYS 顺序给译文(10 语言 = 与上一轮 warn 词条同一批文件) */
const TEXT = {
  en: [
    'Set Warning for All Batches',
    'Apply',
    'Set for all batches of this item in this warehouse',
    'Please enter a warning quantity',
    'Warning quantity applied to all batches',
    'Failed to apply the warning to all batches',
  ],
  ja: [
    '全バッチのアラーム設定',
    '適用',
    'この品目・この倉庫の全バッチに一括設定します',
    'アラーム数量を入力してください',
    '全バッチのアラーム数量を設定しました',
    '全バッチのアラーム設定に失敗しました',
  ],
  ko: [
    '전체 배치 경고 설정',
    '적용',
    '이 품목·이 창고의 모든 배치에 일괄 설정합니다',
    '경고 수량을 입력하세요',
    '모든 배치의 경고 수량을 설정했습니다',
    '전체 배치 경고 설정에 실패했습니다',
  ],
  'zh-TW': [
    '統一預警',
    '套用',
    '對本物料本倉庫的所有批次統一設定',
    '請填寫預警數量',
    '已對全部批次統一設定預警數量',
    '統一設定預警數量失敗',
  ],
  es: [
    'Aviso para todos los lotes',
    'Aplicar',
    'Aplicar a todos los lotes de este artículo en este almacén',
    'Introduzca la cantidad de aviso',
    'Cantidad de aviso aplicada a todos los lotes',
    'No se pudo aplicar el aviso a todos los lotes',
  ],
  fr: [
    'Alerte pour tous les lots',
    'Appliquer',
    'Appliquer à tous les lots de cet article dans cet entrepôt',
    "Veuillez saisir la quantité d'alerte",
    "Quantité d'alerte appliquée à tous les lots",
    "Échec de l'application de l'alerte à tous les lots",
  ],
  de: [
    'Warnung für alle Chargen',
    'Anwenden',
    'Für alle Chargen dieses Artikels in diesem Lager festlegen',
    'Bitte Warnmenge eingeben',
    'Warnmenge für alle Chargen festgelegt',
    'Warnmenge konnte nicht für alle Chargen festgelegt werden',
  ],
  ru: [
    'Предупреждение для всех партий',
    'Применить',
    'Задать для всех партий этого материала на этом складе',
    'Введите количество предупреждения',
    'Предупреждение задано для всех партий',
    'Не удалось задать предупреждение для всех партий',
  ],
  vi: [
    'Cảnh báo cho tất cả lô',
    'Áp dụng',
    'Đặt cho tất cả lô của mặt hàng này trong kho này',
    'Vui lòng nhập số lượng cảnh báo',
    'Đã đặt số lượng cảnh báo cho tất cả các lô',
    'Đặt cảnh báo cho tất cả các lô thất bại',
  ],
  th: [
    'แจ้งเตือนทุกล็อต',
    'ใช้งาน',
    'ตั้งให้ทุกล็อตของสินค้านี้ในคลังนี้',
    'กรุณากรอกจำนวนแจ้งเตือน',
    'ตั้งจำนวนแจ้งเตือนให้ทุกล็อตแล้ว',
    'ตั้งจำนวนแจ้งเตือนทุกล็อตไม่สำเร็จ',
  ],
}

/** JS 单引号字符串转义(译文里有撇号时靠它,免得写坏文件) */
function q(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

let touched = 0
for (const [loc, texts] of Object.entries(TEXT)) {
  if (texts.length !== KEYS.length) throw new Error(`${loc} 词条数不一致`)
  const file = path.join(localesDir, `${loc}.js`)
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const added = []
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i]
    if (lines.some((l) => l.includes(`'${k}':`))) continue   // 幂等:已有则跳过
    added.push([k, texts[i]])
  }
  if (!added.length) { console.log(`[skip] ${loc}.js 已齐`); continue }
  const anchor = lines.findIndex((l) => l.includes("'库存明细':"))
  if (anchor < 0) throw new Error(`${loc}.js 找不到锚点 '库存明细':`)
  const indent = (lines[anchor].match(/^\s*/) || [''])[0]
  const rows = added.map(([k, v]) => `${indent}'${k}': '${q(v)}',`)
  lines.splice(anchor + 1, 0, ...rows)
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
  touched++
  console.log(`[ok] ${loc}.js +${rows.length}`)
}
console.log(`完成:${touched} 个语言文件被写入`)
