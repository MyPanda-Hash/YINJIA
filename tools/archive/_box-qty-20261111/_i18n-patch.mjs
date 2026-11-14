/**
 * _i18n-patch.mjs — 给「打印材料码·每箱数量」补 10 语言词条(2026-11-11)
 *
 * 用户口径「材料码多加一个每箱数量打印,每箱数量才等于标识卡上的数量」+「提示零头箱不足每箱」。
 * 做法:在 frontend/src/i18n/locales/<locale>.js 的 `'本次打印数量':` 那一行**后面**插入新键;
 * 已存在的键跳过(幂等,可重复跑),不覆盖人工校对过的译文。
 *
 * 用法:node tools/archive/_box-qty-20261111/_i18n-patch.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const localesDir = resolve(here, '../../../frontend/src/i18n/locales')

/** 键 → 各语言译文(键顺序固定,写进文件时按此顺序) */
const KEYS = [
  ['每箱数量', {
    en: 'Qty per Box', 'zh-TW': '每箱數量', ja: '1箱あたり数量', ko: '상자당 수량',
    de: 'Menge pro Karton', es: 'Cantidad por caja', fr: 'Quantité par boîte',
    ru: 'Количество в коробке', th: 'จำนวนต่อกล่อง', vi: 'Số lượng mỗi thùng',
  }],
  ['每箱', {
    en: 'Per box', 'zh-TW': '每箱', ja: '1箱あたり', ko: '상자당',
    de: 'Pro Karton', es: 'Por caja', fr: 'Par boîte',
    ru: 'В коробке', th: 'ต่อกล่อง', vi: 'Mỗi thùng',
  }],
  ['整箱', {
    en: 'Full boxes', 'zh-TW': '整箱', ja: '満箱', ko: '온박스',
    de: 'Volle Kartons', es: 'Cajas completas', fr: 'Boîtes complètes',
    ru: 'Полные коробки', th: 'กล่องเต็ม', vi: 'Thùng đầy',
  }],
  ['零头箱', {
    en: 'Partial box', 'zh-TW': '零頭箱', ja: '端数箱', ko: '잔여 상자',
    de: 'Restkarton', es: 'Caja parcial', fr: 'Boîte partielle',
    ru: 'Неполная коробка', th: 'กล่องไม่เต็ม', vi: 'Thùng lẻ',
  }],
  ['不足每箱（可单独打印零头箱）', {
    en: 'less than a full box (print this partial box separately)',
    'zh-TW': '不足每箱（可單獨列印零頭箱）',
    ja: '1箱に満たない（端数箱は別途印刷可）',
    ko: '1상자 미만(잔여 상자는 따로 인쇄 가능)',
    de: 'weniger als ein Karton (Restkarton separat drucken)',
    es: 'menos de una caja (puede imprimir la caja parcial aparte)',
    fr: "moins d'une boîte (imprimer la boîte partielle séparément)",
    ru: 'меньше коробки (неполную можно напечатать отдельно)',
    th: 'น้อยกว่าหนึ่งกล่อง (พิมพ์กล่องไม่เต็มแยกได้)',
    vi: 'ít hơn một thùng (in thùng lẻ riêng)',
  }],
  ['不填按本次打印数量', {
    en: 'Blank = print qty this time',
    'zh-TW': '不填按本次列印數量',
    ja: '未入力なら今回の印刷数量',
    ko: '비우면 이번 인쇄 수량',
    de: 'Leer = Menge dieses Drucks',
    es: 'Vacío = cantidad de esta impresión',
    fr: 'Vide = quantité de cette impression',
    ru: 'Пусто = количество текущей печати',
    th: 'เว้นว่าง = จำนวนที่พิมพ์ครั้งนี้',
    vi: 'Để trống = số lượng lần in này',
  }],
  ['标识卡上的「数量」印每箱数量（一箱一张卡）；打几张卡在打印预览里设置份数', {
    en: 'The label card prints the qty per box as “Quantity” (one card per box); set the number of copies in the print preview',
    'zh-TW': '識別卡上的「數量」印每箱數量（一箱一張卡）；打幾張卡在列印預覽裡設定份數',
    ja: '識別カードの「数量」は1箱あたり数量を印刷（1箱1枚）。印刷枚数はプレビューで部数を指定',
    ko: '식별카드의 "수량"은 상자당 수량을 인쇄합니다(1상자 1장). 인쇄 매수는 미리보기에서 부수를 지정합니다',
    de: 'Die Kennkarte druckt die Menge pro Karton als „Menge“ (ein Karton, eine Karte); Exemplaranzahl im Druckdialog einstellen',
    es: 'La tarjeta imprime la cantidad por caja como «Cantidad» (una tarjeta por caja); indique el número de copias en la vista previa',
    fr: "La carte imprime la quantité par boîte comme « Quantité » (une carte par boîte) ; réglez le nombre de copies dans l'aperçu",
    ru: 'На карточке в поле «Количество» печатается количество в коробке (одна карточка на коробку); число экземпляров задайте в предпросмотре печати',
    th: 'ป้ายพิมพ์จำนวนต่อกล่องในช่อง "จำนวน" (หนึ่งกล่องหนึ่งป้าย) จำนวนสำเนาตั้งได้ในตัวอย่างก่อนพิมพ์',
    vi: 'Thẻ in "Số lượng" theo số lượng mỗi thùng (mỗi thùng một thẻ); số bản in đặt trong xem trước',
  }],
  ['有零头箱：整批不是每箱数量的整数倍，零头箱数量不足每箱，可单独打印零头箱数量', {
    en: 'Partial box: the batch is not a multiple of the qty per box, the partial box is less than a full box and can be printed separately',
    'zh-TW': '有零頭箱：整批不是每箱數量的整數倍，零頭箱數量不足每箱，可單獨列印零頭箱數量',
    ja: '端数箱あり：今回の数量が1箱あたりの倍数ではありません。端数箱は1箱未満なので別途印刷できます',
    ko: '잔여 상자 있음: 이번 수량이 상자당 수량의 배수가 아닙니다. 잔여 상자는 1상자 미만이므로 따로 인쇄할 수 있습니다',
    de: 'Restkarton: Die Menge ist kein Vielfaches der Menge pro Karton; der Restkarton ist weniger als ein Karton und kann separat gedruckt werden',
    es: 'Caja parcial: la cantidad no es múltiplo de la cantidad por caja; la caja parcial tiene menos de una caja y puede imprimirse aparte',
    fr: 'Boîte partielle : la quantité n’est pas un multiple de la quantité par boîte ; elle est inférieure à une boîte et peut être imprimée séparément',
    ru: 'Неполная коробка: количество не кратно количеству в коробке; остаток меньше коробки, его можно напечатать отдельно',
    th: 'มีกล่องไม่เต็ม: จำนวนครั้งนี้ไม่ใช่จำนวนเต็มเท่าของจำนวนต่อกล่อง กล่องไม่เต็มมีจำนวนน้อยกว่าหนึ่งกล่อง พิมพ์แยกได้',
    vi: 'Có thùng lẻ: số lượng không phải bội số của số lượng mỗi thùng; thùng lẻ ít hơn một thùng, có thể in riêng',
  }],
]

const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']
/** 插入锚点:优先「本次打印数量」那一行(材料码同族词条),没有就落到「打印材料码」那一行
 *  (多数语言只译了面板动作名,没译中间的列名 —— 两处都在同一个 biz 对象里,插哪都一样) */
const ANCHORS = [/^(\s*)'本次打印数量':/, /^(\s*)'打印材料码':/]

/** 只有 ASCII 与单双引号需要转义:统一用单引号包,内部单引号转 \' */
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

let added = 0
for (const loc of LOCALES) {
  const file = resolve(localesDir, `${loc}.js`)
  const src = readFileSync(file, 'utf8')
  const lines = src.split(/\r?\n/)
  const missing = KEYS.filter(([key]) => !src.includes(`'${key}':`))
  if (!missing.length) { console.log(`${loc}: 已有全部词条,跳过`); continue }
  let idx = -1
  let indent = '    '
  for (const rx of ANCHORS) {
    const i = lines.findIndex((l) => rx.test(l))
    if (i >= 0) { idx = i; indent = lines[i].match(rx)[1]; break }
  }
  if (idx < 0) { console.error(`${loc}: 找不到锚点,跳过`); continue }
  const block = missing.map(([key, texts]) => `${indent}${q(key)}: ${q(texts[loc] ?? texts.en)},`)
  lines.splice(idx + 1, 0, ...block)
  writeFileSync(file, lines.join('\n'), 'utf8')
  added += missing.length
  console.log(`${loc}: 插入 ${missing.length} 条`)
}
console.log(`完成,共插入 ${added} 条`)
