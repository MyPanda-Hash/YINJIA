import fs from 'node:fs'

/**
 * _i18n-first-insp-zones.mjs — 首件检验单「每个分组各记录 2 支样品」这一轮的显示层词条。
 *
 * 用户口径(2026-10-17):「当前的首件检验单的表格应该是这种实现方式实现的,当前为全部都在最上面
 * 两行可被填写,而不是如图形式实现」。
 *
 * 变更:
 *   ① **删**掉旧词条「按相关要求：每个测试项目只记录 2 支样品（1#、2#）」—— 源码已无引用,
 *      而且它的口径本身就是错的(把"每组 2 支"读成了"每个项目都只记 1#/2#");
 *   ② **加**新词条「按相关要求：本组测试只记录 2 支样品（{a}）」—— {a} 由组件填成本组那两支
 *      (如「3#、4#」),悬停不可填格时提示"去哪填"。
 * zh-CN 是源语言(源码里就是中文,不在 locales 里);锚点 = 各语言包首件检验那批的「已按成型工艺清单」行。
 */
const OLD_KEY = '按相关要求：每个测试项目只记录 2 支样品（1#、2#）'
const NEW_KEY = '按相关要求：本组测试只记录 2 支样品（{a}）'

const TRANSLATIONS = {
  'zh-TW': '按相關要求：本組測試只記錄 2 支樣品（{a}）',
  en: 'Per the requirements: this group records only 2 samples ({a})',
  ja: '関連要求により、本グループは2本のサンプル（{a}）のみ記録する',
  ko: '관련 요구사항: 본 그룹은 2개 샘플({a})만 기록한다',
  de: 'Laut Vorgabe: diese Gruppe erfasst nur 2 Proben ({a})',
  es: 'Según los requisitos: este grupo registra solo 2 muestras ({a})',
  fr: 'Selon les exigences : ce groupe ne consigne que 2 échantillons ({a})',
  ru: 'По требованию: в этой группе записывают только 2 образца ({a})',
  vi: 'Theo yêu cầu: nhóm này chỉ ghi 2 mẫu ({a})',
  th: 'ตามข้อกำหนด: กลุ่มนี้บันทึกเพียง 2 ตัวอย่าง ({a})',
}

let files = 0
for (const [loc, text] of Object.entries(TRANSLATIONS)) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  let s = fs.readFileSync(p, 'utf8')
  const before = s.length

  // ① 删旧词条(整行 = 键 + 值;只按"行首缩进 + 该键"定位,值原样不解析)
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const oldLine = new RegExp(`^[ \\t]*${esc(JSON.stringify(OLD_KEY))}:[^\\n]*\\n`, 'm')
  const m = s.match(oldLine)
  if (m) s = s.replace(oldLine, '')

  // ② 加新词条(锚点 = 「已按成型工艺清单」那一行前)
  let added = false
  if (!s.includes(`${JSON.stringify(NEW_KEY)}:`)) {
    const anchor = '    "已按成型工艺清单":'
    const i = s.indexOf(anchor)
    if (i < 0) { console.log(`SKIP ${loc}: 锚点缺失`); continue }
    s = s.slice(0, i) + `    ${JSON.stringify(NEW_KEY)}: ${JSON.stringify(text)},\n` + s.slice(i)
    added = true
  }

  if (s.length === before) { console.log(`SKIP ${loc}: 无需改动`); continue }
  fs.writeFileSync(p, s, 'utf8')
  console.log(`OK   ${loc}: 删旧=${m ? 1 : 0} 加新=${added ? 1 : 0}`)
  files++
}
console.log(`\n共 ${files} 个语言包`)
