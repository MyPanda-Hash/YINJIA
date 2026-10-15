import fs from 'node:fs'

/**
 * _i18n-first-insp-reqs.mjs — 首件检验单「相关要求落地」这一批显示层词条,一次写进 10 个语言包。
 *
 * 用户口径(2026-10-16 第三轮):「这个是针对当前的首件检验单的相关要求内容,查看一下下面所述的各项要求并实现。」
 * 本批新增的**显示层**文案(其余提醒条直接复用纸面《相关要求》原有的 6 条译名,不重复插):
 *   ① 2 支样品规则的格子提示(3#..8# 悬停);
 *   ② 精度规则:内外径/长度/重量 1 位小数的列头提示 + 取整提示;
 *   ③ 挤压强度/压降「按表显数据记录(不取整)」列头提示;
 *   ④ 浊度→压降 测试顺序提示。
 * zh-CN 是源语言(源码里就是中文,不在 locales 里);锚点 = 各语言包首件检验那批的「已按成型工艺清单」行。
 */
const BLOCKS = {
  'zh-TW': {
    '按相关要求：每个测试项目只记录 2 支样品（1#、2#）': '按相關要求：每個測試項目只記錄 2 支樣品（1#、2#）',
    '按相关要求：内外径、长度及重量保留小数点后1位': '按相關要求：內外徑、長度及重量保留小數點後1位',
    '按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）': '按相關要求：內外徑、長度及重量保留小數點後1位（已取整：{a} → {b}）',
    '按表显数据记录（不取整）': '按表顯資料記錄（不取整）',
    '本单同时有浊度与压降两项测试：请先测初始浊度，再进行压降测试。': '本單同時有濁度與壓降兩項測試：請先測初始濁度，再進行壓降測試。',
  },
  ja: {
    '按相关要求：每个测试项目只记录 2 支样品（1#、2#）': '関連要求により、各試験項目は2本のサンプル（1#、2#）のみ記録する',
    '按相关要求：内外径、长度及重量保留小数点后1位': '関連要求により、内外径・長さ・重量は小数点以下1桁で記録する',
    '按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）': '関連要求により、内外径・長さ・重量は小数点以下1桁（丸め：{a} → {b}）',
    '按表显数据记录（不取整）': '表示値のまま記録（丸めなし）',
    '本单同时有浊度与压降两项测试：请先测初始浊度，再进行压降测试。': '本票は濁度と圧力損失の両方を試験する：先に初期濁度を測定し、その後圧力損失を測定する。',
  },
  ko: {
    '按相关要求：每个测试项目只记录 2 支样品（1#、2#）': '관련 요구사항: 각 시험 항목은 2개 샘플(1#, 2#)만 기록한다',
    '按相关要求：内外径、长度及重量保留小数点后1位': '관련 요구사항: 내외경, 길이 및 중량은 소수점 1자리까지 기록한다',
    '按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）': '관련 요구사항: 내외경, 길이 및 중량은 소수점 1자리(반올림: {a} → {b})',
    '按表显数据记录（不取整）': '표시값 그대로 기록(반올림 없음)',
    '本单同时有浊度与压降两项测试：请先测初始浊度，再进行压降测试。': '이 전표는 탁도와 압력 강하를 모두 시험한다: 초기 탁도를 먼저 측정한 후 압력 강하를 측정한다.',
  },
  de: {
    '按相关要求：每个测试项目只记录 2 支样品（1#、2#）': 'Laut Vorgabe: je Prüfposition nur 2 Proben (1#, 2#) erfassen',
    '按相关要求：内外径、长度及重量保留小数点后1位': 'Laut Vorgabe: Innen-/Außendurchmesser, Länge und Gewicht mit 1 Nachkommastelle',
    '按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）': 'Laut Vorgabe: Innen-/Außendurchmesser, Länge und Gewicht mit 1 Nachkommastelle (gerundet: {a} → {b})',
    '按表显数据记录（不取整）': 'Anzeigewert übernehmen (keine Rundung)',
    '本单同时有浊度与压降两项测试：请先测初始浊度，再进行压降测试。': 'Dieser Beleg prüft Trübung und Druckverlust: zuerst die Anfangstrübung, dann den Druckverlust messen.',
  },
  es: {
    '按相关要求：每个测试项目只记录 2 支样品（1#、2#）': 'Según los requisitos: registre solo 2 muestras (1#, 2#) por partida',
    '按相关要求：内外径、长度及重量保留小数点后1位': 'Según los requisitos: diámetro interior/exterior, longitud y peso con 1 decimal',
    '按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）': 'Según los requisitos: diámetro interior/exterior, longitud y peso con 1 decimal (redondeado: {a} → {b})',
    '按表显数据记录（不取整）': 'Registre el valor mostrado (sin redondear)',
    '本单同时有浊度与压降两项测试：请先测初始浊度，再进行压降测试。': 'Esta hoja tiene turbidez y caída de presión: mida primero la turbidez inicial y luego la caída de presión.',
  },
  fr: {
    '按相关要求：每个测试项目只记录 2 支样品（1#、2#）': 'Selon les exigences : ne consigner que 2 échantillons (1#, 2#) par rubrique',
    '按相关要求：内外径、长度及重量保留小数点后1位': 'Selon les exigences : diamètre intérieur/extérieur, longueur et poids avec 1 décimale',
    '按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）': 'Selon les exigences : diamètre intérieur/extérieur, longueur et poids avec 1 décimale (arrondi : {a} → {b})',
    '按表显数据记录（不取整）': 'Relever la valeur affichée (sans arrondi)',
    '本单同时有浊度与压降两项测试：请先测初始浊度，再进行压降测试。': 'Cette fiche comporte turbidité et perte de charge : mesurer d’abord la turbidité initiale, puis la perte de charge.',
  },
  ru: {
    '按相关要求：每个测试项目只记录 2 支样品（1#、2#）': 'По требованию: по каждому пункту записывают только 2 образца (1#, 2#)',
    '按相关要求：内外径、长度及重量保留小数点后1位': 'По требованию: внутренний/наружный диаметр, длина и масса — 1 знак после запятой',
    '按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）': 'По требованию: внутренний/наружный диаметр, длина и масса — 1 знак после запятой (округлено: {a} → {b})',
    '按表显数据记录（不取整）': 'Записывать показание прибора (без округления)',
    '本单同时有浊度与压降两项测试：请先测初始浊度，再进行压降测试。': 'В этом листе есть и мутность, и перепад давления: сначала измеряют начальную мутность, затем перепад давления.',
  },
  vi: {
    '按相关要求：每个测试项目只记录 2 支样品（1#、2#）': 'Theo yêu cầu: mỗi hạng mục chỉ ghi 2 mẫu (1#, 2#)',
    '按相关要求：内外径、长度及重量保留小数点后1位': 'Theo yêu cầu: đường kính trong/ngoài, chiều dài và khối lượng giữ 1 chữ số thập phân',
    '按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）': 'Theo yêu cầu: đường kính trong/ngoài, chiều dài và khối lượng giữ 1 chữ số thập phân (đã làm tròn: {a} → {b})',
    '按表显数据记录（不取整）': 'Ghi theo giá trị hiển thị (không làm tròn)',
    '本单同时有浊度与压降两项测试：请先测初始浊度，再进行压降测试。': 'Phiếu này có cả độ đục và tổn thất áp suất: đo độ đục ban đầu trước, rồi đo tổn thất áp suất.',
  },
  th: {
    '按相关要求：每个测试项目只记录 2 支样品（1#、2#）': 'ตามข้อกำหนด: แต่ละรายการบันทึกเพียง 2 ตัวอย่าง (1#, 2#)',
    '按相关要求：内外径、长度及重量保留小数点后1位': 'ตามข้อกำหนด: เส้นผ่านศูนย์กลางใน/นอก ความยาว และน้ำหนัก เก็บทศนิยม 1 ตำแหน่ง',
    '按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）': 'ตามข้อกำหนด: เส้นผ่านศูนย์กลางใน/นอก ความยาว และน้ำหนัก เก็บทศนิยม 1 ตำแหน่ง (ปัดเศษ: {a} → {b})',
    '按表显数据记录（不取整）': 'บันทึกตามค่าที่แสดง (ไม่ปัดเศษ)',
    '本单同时有浊度与压降两项测试：请先测初始浊度，再进行压降测试。': 'ใบนี้มีทั้งความขุ่นและแรงดันตก: วัดความขุ่นเริ่มต้นก่อน แล้วจึงวัดแรงดันตก',
  },
  en: {
    '按相关要求：每个测试项目只记录 2 支样品（1#、2#）': 'Per the requirements: record only 2 samples (1#, 2#) for each test item',
    '按相关要求：内外径、长度及重量保留小数点后1位': 'Per the requirements: inner/outer diameter, length and weight keep 1 decimal place',
    '按相关要求：内外径、长度及重量保留小数点后1位（已取整：{a} → {b}）': 'Per the requirements: inner/outer diameter, length and weight keep 1 decimal place (rounded: {a} → {b})',
    '按表显数据记录（不取整）': 'Record the value shown on the meter (no rounding)',
    '本单同时有浊度与压降两项测试：请先测初始浊度，再进行压降测试。': 'This sheet has both turbidity and pressure drop: test initial turbidity first, then pressure drop.',
  },
}

let files = 0
let keys = 0
for (const [loc, block] of Object.entries(BLOCKS)) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  let s = fs.readFileSync(p, 'utf8')
  const anchor = '    "已按成型工艺清单":'
  const i = s.indexOf(anchor)
  if (i < 0) { console.log(`SKIP ${loc}: 锚点缺失`); continue }
  const add = Object.entries(block)
    .filter(([k]) => !s.includes(`${JSON.stringify(k)}:`))
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n')
  if (!add) { console.log(`SKIP ${loc}: 已全部存在`); continue }
  s = s.slice(0, i) + add + '\n' + s.slice(i)
  fs.writeFileSync(p, s, 'utf8')
  console.log(`OK   ${loc}: +${add.split('\n').length} 条`)
  files++
  keys += add.split('\n').length
}
console.log(`\n共 ${files} 个语言包 / ${keys} 条词条`)
