// gen-doc-translations.cjs — 单据/报表字段+面板名 → 9 语言机翻 → yj_translation
const fs = require('fs')
const path = require('path')
const LOCALES = ['en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']
const panels = JSON.parse(fs.readFileSync(path.join(__dirname, '_doc_panels.json'), 'utf8'))
const NAMES = { PURCHASE_IN: '采购入库单', FINISH_IN: '产成品入库单', OTHER_IN: '其他入库单', SALE_OUT: '销售出库单', MATERIAL_OUT: '材料出库单', OTHER_OUT: '其他出库单', PU_REQ: '请购单', PU_ORDER: '采购订单', MANU_ORDER: '生产加工单', DISPATCH: '工序派工单', OUTSOURCE_ORDER: '委外加工单', OUTSOURCE_IN: '委外入库单', OUTSOURCE_ISSUE: '委外发料单', PURCHASE_IN_DETAIL: '采购入库单明细表', PURCHASE_IN_STATS: '采购入库单统计表', FINISH_IN_DETAIL: '产成品入库单明细表', FINISH_IN_STATS: '产成品入库单统计表', OTHER_IN_DETAIL: '其他入库单明细表', OTHER_IN_STATS: '其他入库单统计表', SALE_OUT_DETAIL: '销售出库单明细表', SALE_OUT_STATS: '销售出库单统计表', MATERIAL_OUT_DETAIL: '材料出库单明细表', MATERIAL_OUT_STATS: '材料出库单统计表', OTHER_OUT_DETAIL: '其他出库单明细表', OTHER_OUT_STATS: '其他出库单统计表', MANU_ORDER_DETAIL: '生产加工单明细表', MANU_ORDER_STATS: '生产加工单统计表' }
const words = new Set(Object.values(NAMES))
for (const p of panels) {
  if (p.kind === 'doc') { for (const f of p.hFields) words.add(f.name); for (const f of p.lFields) words.add(f.name) }
}
const KEYS = [...words]
console.log(`唯一词条:${KEYS.length}`)

async function main() {
  const out = ['-- 单据/报表词条', 'USE HSDZ_MES;', 'SET NOCOUNT ON;', '']
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
      const isPanel = Object.values(NAMES).includes(k)
      const scope = isPanel ? 'panel' : 'field'
      const escK = k.replace(/'/g, "''"), escV = String(v).replace(/'/g, "''").replace(/\r?\n/g, ' ')
      out.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='${scope}' AND ref_key=N'${escK}' AND locale='${locale}') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('${scope}', N'${escK}', '${locale}', N'${escV}', 'manual');`)
      n++
    }
    console.log(`${locale}: ${n}/${KEYS.length}`)
  }
  fs.writeFileSync(path.join(__dirname, '_doc_part4_translations.sql'), out.join('\n') + '\n', 'utf8')
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
