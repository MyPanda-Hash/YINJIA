import fs from 'node:fs'
import path from 'node:path'

/**
 * _i18n-first-insp.mjs — 首件检验单(2026-10-15)的显示层词条,一次写进 10 个语言包。
 *
 * 为什么不止 en:AGENTS.md 多语言规范要求「新增面板/UI 功能必须同时交付对应多语言数据,
 * 判定标准 = 切到英语/日语后新功能显示目标语言而非中文」。面板名与按钮名都走 tt() 显示层,
 * 所以每个语言包都要有;zh-CN 是源语言(中文即键),不写。
 *
 * 幂等:某语言已经有该键就跳过(不覆盖既有译名 —— 人工校对过的以人工为准)。
 * 用法: node tools/archive/_i18n-first-insp.mjs
 */
const DIR = 'frontend/src/i18n/locales'

/** 中文原文 → 各语言译名(en 为强制项,其余按各语言习惯;命名对齐仓库既有的 面板名/按钮名 词条风格) */
const DICT = {
  '首件检验单': {
    en: 'First Article Inspection Sheet',
    'zh-TW': '首件檢驗單',
    ja: '初品検査シート',
    ko: '초품 검사표',
    de: 'Erstmusterprüfblatt',
    es: 'Hoja de inspección de primera pieza',
    fr: 'Fiche de contrôle de la première pièce',
    ru: 'Лист контроля первого изделия',
    vi: 'Phiếu kiểm tra chi tiết đầu tiên',
    th: 'ใบตรวจสอบชิ้นแรก',
  },
  '取成型工艺清单': {
    en: 'Fetch from Molding Process Sheet',
    'zh-TW': '取成型工藝清單',
    ja: '成形工程票から取得',
    ko: '성형 공정표에서 가져오기',
    de: 'Aus Formprozessblatt übernehmen',
    es: 'Tomar de la hoja de proceso de moldeo',
    fr: 'Reprendre depuis la fiche de process de moulage',
    ru: 'Взять из технологической карты формования',
    vi: 'Lấy từ phiếu công nghệ tạo hình',
    th: 'ดึงจากใบกระบวนการขึ้นรูป',
  },
  '该产品没有成型工艺清单': {
    en: 'No molding process sheet for this product',
    'zh-TW': '該產品沒有成型工藝清單',
    ja: 'この製品の成形工程票がありません',
    ko: '이 제품의 성형 공정표가 없습니다',
    de: 'Für dieses Produkt gibt es kein Formprozessblatt',
    es: 'Este producto no tiene hoja de proceso de moldeo',
    fr: "Ce produit n'a pas de fiche de process de moulage",
    ru: 'Для этого изделия нет технологической карты формования',
    vi: 'Sản phẩm này không có phiếu công nghệ tạo hình',
    th: 'ผลิตภัณฑ์นี้ไม่มีใบกระบวนการขึ้นรูป',
  },
  '取成型工艺清单失败': {
    en: 'Failed to fetch the molding process sheet',
    'zh-TW': '取成型工藝清單失敗',
    ja: '成形工程票の取得に失敗しました',
    ko: '성형 공정표를 가져오지 못했습니다',
    de: 'Formprozessblatt konnte nicht übernommen werden',
    es: 'No se pudo tomar la hoja de proceso de moldeo',
    fr: 'Échec de la reprise depuis la fiche de process de moulage',
    ru: 'Не удалось получить технологическую карту формования',
    vi: 'Không lấy được phiếu công nghệ tạo hình',
    th: 'ดึงใบกระบวนการขึ้นรูปไม่สำเร็จ',
  },
  '已按成型工艺清单': {
    en: 'Fetched from molding process sheet',
    'zh-TW': '已按成型工藝清單',
    ja: '成形工程票に基づき取得',
    ko: '성형 공정표 기준으로 가져옴',
    de: 'Aus dem Formprozessblatt übernommen',
    es: 'Tomado de la hoja de proceso de moldeo',
    fr: 'Repris depuis la fiche de process de moulage',
    ru: 'Взято из технологической карты формования',
    vi: 'Đã lấy theo phiếu công nghệ tạo hình',
    th: 'ดึงตามใบกระบวนการขึ้นรูปแล้ว',
  },
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.js') && f !== 'zh-CN.js')
let touched = 0
let added = 0
for (const f of files) {
  const locale = f.replace(/\.js$/, '')
  const p = path.join(DIR, f)
  let txt = fs.readFileSync(p, 'utf8')
  const lines = []
  for (const [zh, byLocale] of Object.entries(DICT)) {
    const val = byLocale[locale]
    if (!val) continue
    // 键已存在(任意形式)⇒ 跳过,不覆盖人工译名
    if (new RegExp(`(['"]|\`)${escapeRe(zh)}\\1\\s*:`).test(txt)) continue
    lines.push(`    ${JSON.stringify(zh)}: ${JSON.stringify(val)},`)
  }
  if (!lines.length) { console.log(`SKIP ${f}`); continue }
  // 语言包是 CRLF 行尾(实测),锚点与插入块都要用 \r\n,否则写出混合行尾
  const nl = txt.includes('\r\n') ? '\r\n' : '\n'
  const anchor = /(\r?\n\s*biz:\s*\{\r?\n)/
  if (!anchor.test(txt)) { console.log(`WARN ${f}: 未找到 biz 锚点,跳过`); continue }
  const block = `    // ---- 首件检验单(QC_FIRST_INSP,2026-10-15)----${nl}${lines.join(nl)}${nl}`
  txt = txt.replace(anchor, `$1${block}`)
  fs.writeFileSync(p, txt, 'utf8')
  touched++
  added += lines.length
  console.log(`OK   ${f}  +${lines.length}`)
}
console.log(`\n共 ${touched} 个语言包,+${added} 条词条`)

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
