// gen-bs-translations.cjs — 18 面板名+字段标签 → 机翻 9 语言 → yj_translation(field/panel scope)
const fs = require('fs')
const path = require('path')
const LOCALES = ['en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']
const panels = JSON.parse(fs.readFileSync(path.join(__dirname, '_bs_panels.json'), 'utf8'))
const PANEL_NAMES = { DEPT: '部门', EMP: '员工', PARTNER: '往来单位', UOM: '计量单位', INV: '存货', EQUIP: '设备', TEAM: '班组', WC: '工作中心', OP: '工序', ROUTE: '工艺路线', BOM: '物料清单', WH: '仓库', REGION: '地区', PROJ: '项目', REJECT: '不合格原因', QC_ITEM: '检验项目', QC_PLAN: '检验方案', INV_PRICE: '存货价格本' }

// 唯一词:面板名 + 字段名(en 已有的基础词复用人工译名)
const words = new Set()
for (const [code, name] of Object.entries(PANEL_NAMES)) words.add(name)
for (const p of panels) for (const f of p.fields) words.add(f.name)
const KEYS = [...words]
console.log(`待翻译唯一词条:${KEYS.length}`)

async function main() {
  const out = ['-- 基础设置词条(9 语言,机翻+复用缓存)', 'USE HSDZ_MES;', 'SET NOCOUNT ON;', '']
  for (const locale of LOCALES) {
    const res = await fetch('http://localhost:8090/api/locale/dict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale, keys: KEYS }),
    })
    const j = await res.json()
    const dict = (j && j.data && j.data.dict) || {}
    let n = 0
    for (const k of KEYS) {
      const v = dict[k]
      if (!v) continue
      const scope = Object.prototype.hasOwnProperty.call(PANEL_NAMES, [...Object.entries(PANEL_NAMES).find(([, n]) => n === k) || []].map(([c]) => c)[0]) && Object.values(PANEL_NAMES).includes(k) ? 'panel' : 'field'
      const escK = k.replace(/'/g, "''"), escV = String(v).replace(/'/g, "''").replace(/\r?\n/g, ' ')
      out.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='${scope}' AND ref_key=N'${escK}' AND locale='${locale}') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('${scope}', N'${escK}', '${locale}', N'${escV}', 'manual');`)
      n++
    }
    console.log(`${locale}: ${n}/${KEYS.length}`)
  }
  fs.writeFileSync(path.join(__dirname, '_bs_part4_translations.sql'), out.join('\n') + '\n', 'utf8')
  console.log('已生成 _bs_part4_translations.sql')
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
