/** 临时只读:打印 5 张检验单头表列 + 候选单关键签署列当前值 */
import { openTestDb, qs } from './_lib.mjs'

const db = await openTestDb()
const TABLES = {
  QC_FIRST_INSP: 'qc_first_insp_head',
  QC_PROC_INSP: 'qc_proc_insp_head',
  QC_ASM_INSP: 'qc_asm_insp_head',
  QC_OQC_REPORT: 'qc_oqc_head',
  QC_INSP: 'qc_insp',
}
for (const [panel, t] of Object.entries(TABLES)) {
  const cols = (await db.q(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' ORDER BY ORDINAL_POSITION`)).map((c) => c.COLUMN_NAME)
  console.log(`\n${panel} (${t}) ${cols.length} 列:\n` + cols.join(', '))
  const signLike = cols.filter((c) => /检验员|审核|批准|审批|编制|填写|检测人/.test(c))
  console.log('签署类列:', signLike.join(', '))
}
// 候选单据当前的签署列值
const CAND = {
  QC_FIRST_INSP: 'SJ-2026-10-0132',
  QC_PROC_INSP: 'ZC-2026-10-0016',
  QC_ASM_INSP: 'ZJ-2026-10-0135',
  QC_OQC_REPORT: 'OQC-2026-11-0004',
  QC_INSP: 'IJ-2026-09-0152',
}
for (const [panel, no] of Object.entries(CAND)) {
  const t = TABLES[panel]
  const cols = (await db.q(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' ORDER BY ORDINAL_POSITION`)).map((c) => c.COLUMN_NAME)
  const signLike = cols.filter((c) => /检验员|审核|批准|审批|编制|填写|检测人|处理方式|入库单号|检验结论|总结论|合格数量/.test(c))
  if (!signLike.length) { console.log(`\n${panel}/${no}: 无签署类列`); continue }
  const row = await db.one(`SELECT ${signLike.map((c) => `[${c}]`).join(', ')} FROM ${t} WHERE 单据编号='${qs(no)}'`)
  console.log(`\n${panel}/${no} 当前签署值:`, JSON.stringify(row))
  const st = await db.one(`SELECT * FROM yj_doc_status WHERE panel_code='${panel}' AND doc_no='${qs(no)}'`)
  console.log('  yj_doc_status:', st ? JSON.stringify(st) : '(无行)')
  const appr = await db.q(`SELECT id, action, result, node_no, operator FROM yj_form_approval WHERE panel_code='${panel}' AND form_no='${qs(no)}' ORDER BY id`)
  console.log('  yj_form_approval:', appr.length ? JSON.stringify(appr) : '(无)')
}
await db.close()
