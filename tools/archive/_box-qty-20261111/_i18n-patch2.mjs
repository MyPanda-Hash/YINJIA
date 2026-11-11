/**
 * _i18n-patch2.mjs —「每箱数量」第二轮(2026-11-11):删旧提示词条 + 补「张数/零头卡/必填」词条
 *
 * 用户口径(同一天追加):
 *   「不要有这个提示,这个设计为必填」           ⇒ 撤掉「打几张卡在打印预览里设置份数」那条;
 *   「打印份数还是通过 打印数量/每箱数量 计算出来」⇒ 张数自动算,不再是"预览里设份数";
 *   「零头箱取也根据计算带出」                   ⇒ 零头自动出一张卡(词条改成"自动出零头卡");
 *   「还要记录的打印里面对零头箱做标记」          ⇒ 记录表加「标签张数」「零头箱」两列。
 *
 * 幂等:已存在的键跳过、要删的键不存在也跳过。可重复跑。
 * 用法:node tools/archive/_box-qty-20261111/_i18n-patch2.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const localesDir = resolve(here, '../../../frontend/src/i18n/locales')

/** 要撤掉的旧词条(第一轮加的,第二轮口径变了) */
const REMOVE = [
  '不填按本次打印数量',
  '标识卡上的「数量」印每箱数量（一箱一张卡）；打几张卡在打印预览里设置份数',
  '有零头箱：整批不是每箱数量的整数倍，零头箱数量不足每箱，可单独打印零头箱数量',
  '不足每箱（可单独打印零头箱）',
]

/** 新增词条 → 各语言译文 */
const KEYS = [
  ['必填', {
    en: 'Required', 'zh-TW': '必填', ja: '必須', ko: '필수',
    de: 'Pflichtfeld', es: 'Obligatorio', fr: 'Obligatoire',
    ru: 'Обязательно', th: 'จำเป็น', vi: 'Bắt buộc',
  }],
  ['共 {n} 张', {
    en: '{n} labels', 'zh-TW': '共 {n} 張', ja: '計 {n} 枚', ko: '총 {n}장',
    de: '{n} Etiketten', es: '{n} etiquetas', fr: '{n} étiquettes',
    ru: 'Всего {n} этикеток', th: 'ทั้งหมด {n} ป้าย', vi: 'Tổng {n} nhãn',
  }],
  ['不足每箱（自动出零头卡）', {
    en: 'less than a full box (extra partial-box label printed automatically)',
    'zh-TW': '不足每箱（自動出零頭卡）',
    ja: '1箱に満たない（端数箱ラベルを自動印刷）',
    ko: '1상자 미만(잔여 상자 라벨 자동 인쇄)',
    de: 'weniger als ein Karton (Restkarton-Etikett wird automatisch gedruckt)',
    es: 'menos de una caja (la etiqueta de la caja parcial se imprime automáticamente)',
    fr: "moins d'une boîte (l'étiquette de la boîte partielle est imprimée automatiquement)",
    ru: 'меньше коробки (этикетка неполной коробки печатается автоматически)',
    th: 'น้อยกว่าหนึ่งกล่อง (พิมพ์ป้ายกล่องไม่เต็มให้อัตโนมัติ)',
    vi: 'ít hơn một thùng (nhãn thùng lẻ được in tự động)',
  }],
  ['请填写每箱数量（必填）', {
    en: 'Please enter the qty per box (required)',
    'zh-TW': '請填寫每箱數量（必填）',
    ja: '1箱あたり数量を入力してください（必須）',
    ko: '상자당 수량을 입력하세요(필수)',
    de: 'Bitte Menge pro Karton eingeben (Pflichtfeld)',
    es: 'Introduzca la cantidad por caja (obligatorio)',
    fr: 'Veuillez saisir la quantité par boîte (obligatoire)',
    ru: 'Укажите количество в коробке (обязательно)',
    th: 'กรุณากรอกจำนวนต่อกล่อง (จำเป็น)',
    vi: 'Vui lòng nhập số lượng mỗi thùng (bắt buộc)',
  }],
  ['按每箱数量算出的标签张数过多（{n} 张），请核对每箱数量', {
    en: 'Too many labels from this qty per box ({n}); please check it',
    'zh-TW': '按每箱數量算出的標籤張數過多（{n} 張），請核對每箱數量',
    ja: '1箱あたり数量から算出したラベル枚数が多すぎます（{n} 枚）。確認してください',
    ko: '상자당 수량으로 계산한 라벨 수가 너무 많습니다({n}장). 확인하세요',
    de: 'Zu viele Etiketten aus dieser Menge pro Karton ({n}); bitte prüfen',
    es: 'Demasiadas etiquetas para esa cantidad por caja ({n}); revísela',
    fr: 'Trop d’étiquettes pour cette quantité par boîte ({n}) ; veuillez vérifier',
    ru: 'Слишком много этикеток ({n}); проверьте количество в коробке',
    th: 'จำนวนป้ายที่คำนวณได้มากเกินไป ({n}) กรุณาตรวจสอบจำนวนต่อกล่อง',
    vi: 'Số nhãn tính ra quá nhiều ({n}); vui lòng kiểm tra số lượng mỗi thùng',
  }],
  ['有零头箱：整批不是每箱数量的整数倍，零头箱会单独出一张卡（卡面印零头数量）', {
    en: 'Partial box: the batch is not a multiple of the qty per box; one extra label is printed for the partial box (showing its qty)',
    'zh-TW': '有零頭箱：整批不是每箱數量的整數倍，零頭箱會單獨出一張卡（卡面印零頭數量）',
    ja: '端数箱あり：今回の数量が1箱あたりの倍数ではありません。端数箱は専用ラベルを1枚自動印刷します（数量は端数）',
    ko: '잔여 상자 있음: 이번 수량이 상자당 수량의 배수가 아닙니다. 잔여 상자는 전용 라벨 1장을 자동 인쇄합니다',
    de: 'Restkarton: Die Menge ist kein Vielfaches der Menge pro Karton; für den Restkarton wird ein eigenes Etikett gedruckt',
    es: 'Caja parcial: la cantidad no es múltiplo de la cantidad por caja; se imprime una etiqueta propia para la caja parcial',
    fr: 'Boîte partielle : la quantité n’est pas un multiple de la quantité par boîte ; une étiquette dédiée est imprimée',
    ru: 'Неполная коробка: количество не кратно количеству в коробке; для неё печатается отдельная этикетка',
    th: 'มีกล่องไม่เต็ม: จำนวนไม่ใช่จำนวนเต็มเท่าของจำนวนต่อกล่อง จะพิมพ์ป้ายแยกอีก 1 ป้าย',
    vi: 'Có thùng lẻ: số lượng không phải bội số của số lượng mỗi thùng; sẽ in thêm một nhãn riêng',
  }],
  ['标签张数', {
    en: 'Labels', 'zh-TW': '標籤張數', ja: 'ラベル枚数', ko: '라벨 수',
    de: 'Etiketten', es: 'Etiquetas', fr: 'Étiquettes',
    ru: 'Этикеток', th: 'จำนวนป้าย', vi: 'Số nhãn',
  }],
]

const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** 插入锚点:第一轮插的那批词条里的第一行(所有语言都有) */
const ANCHORS = [/^(\s*)'每箱数量':/, /^(\s*)'每箱':/, /^(\s*)'本次打印数量':/, /^(\s*)'打印材料码':/]

let total = 0
for (const loc of LOCALES) {
  const file = resolve(localesDir, `${loc}.js`)
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  // ① 删旧词条
  let removed = 0
  for (const key of REMOVE) {
    const rx = new RegExp(`^\\s*'${esc(key)}':\\s*.*$`)
    for (let i = lines.length - 1; i >= 0; i--) {
      if (rx.test(lines[i])) { lines.splice(i, 1); removed++ }
    }
  }
  // ② 插新词条(缺哪个补哪个)
  const src = lines.join('\n')
  const missing = KEYS.filter(([k]) => !src.includes(`'${k}':`))
  let inserted = 0
  if (missing.length) {
    let idx = -1
    let indent = '    '
    for (const rx of ANCHORS) {
      const i = lines.findIndex((l) => rx.test(l))
      if (i >= 0) { idx = i; indent = lines[i].match(rx)[1]; break }
    }
    if (idx < 0) { console.error(`${loc}: 找不到锚点,跳过插入`); continue }
    const block = missing.map(([k, texts]) => `${indent}${q(k)}: ${q(texts[loc] ?? texts.en)},`)
    lines.splice(idx + 1, 0, ...block)
    inserted = missing.length
  }
  writeFileSync(file, lines.join('\n'), 'utf8')
  total += inserted
  console.log(`${loc}: 删 ${removed} 条旧词条,插 ${inserted} 条新词条`)
}
console.log(`完成,共插入 ${total} 条`)
