/**
 * _probe2.mjs —— 候选草稿细节盘点(只读)
 *
 * 对 5 张检验面板列出「草稿候选」的:编号/日期/关键表头值/明细行数/已存在的流程链(form_flow_link)
 * 目的:挑一张不会因为下游已审核/检验目录已完结而卡住弃审的草稿。
 */
import path from 'node:path'
import { login, api, openTestDb, qs, S, saveJson, nowStamp, EVIDENCE } from './_lib.mjs'

const BASE = process.env.YJ_BASE || 'http://127.0.0.1:8090'
const PANELS = {
  QC_FIRST_INSP: { head: 'qc_first_insp_head', detail: 'qc_first_insp_detail' },
  QC_PROC_INSP: { head: 'qc_proc_insp_head', detail: 'qc_proc_insp_detail' },
  QC_ASM_INSP: { head: 'qc_asm_insp_head', detail: 'qc_asm_insp_detail' },
  QC_OQC_REPORT: { head: 'qc_oqc_head', detail: 'qc_oqc_detail' },
  QC_INSP: { head: 'qc_insp', detail: 'qc_insp_detail' },
}
const out = { at: new Date().toISOString(), panels: {} }
const db = await openTestDb()
const dbName = (await db.one('SELECT DB_NAME() AS db')).db
if (dbName !== 'HSDZ_MES_TEST') throw new Error('拒绝:非测试库 ' + dbName)
console.log('[db]', dbName)

// 流程链表存在性
const linkCols = await db.q(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='form_flow_link' ORDER BY ORDINAL_POSITION`)
out.form_flow_link_cols = linkCols.map((c) => c.COLUMN_NAME)
console.log('[form_flow_link]', out.form_flow_link_cols.join(','))

for (const [panel, t] of Object.entries(PANELS)) {
  const headCols = (await db.q(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t.head}' ORDER BY ORDINAL_POSITION`)).map((c) => c.COLUMN_NAME)
  const keyCols = headCols.filter((c) => /日期|编号|工单|批次|产品|客户|检验|状态|数量|判定|结论|类型|仓库|供应商/.test(c)).slice(0, 30)
  const selCols = keyCols.map((c) => `h.[${c}]`).join(', ')
  const rows = await db.q(`
    SELECT TOP 8 h.单据编号 no, ${selCols},
           (SELECT COUNT(*) FROM ${t.detail} d WHERE d.单据编号=h.单据编号) det,
           ISNULL(s.pending,'') pending, ISNULL(CAST(s.approve_node AS varchar(5)),'') node,
           ISNULL(s.shr,'') shr, ISNULL(s.pending_by,'') pending_by, ISNULL(s.archived,'') archived
      FROM ${t.head} h
      LEFT JOIN yj_doc_status s ON s.panel_code='${panel}' AND s.doc_no=h.单据编号
     WHERE ISNULL(h.asp_cancel,'N') <> 'Y'
       AND (s.doc_no IS NULL OR (ISNULL(s.pending,'') <> 'Y' AND ISNULL(s.shr,'')='' AND ISNULL(s.archived,'')=''))
     ORDER BY h.单据编号 DESC`)
  out.panels[panel] = { headCols, keyCols, candidates: rows }
  console.log(`\n===== ${panel} (${t.head}) 草稿候选 =====`)
  for (const r of rows) {
    console.log(`- ${r.no} 明细行=${r.det} pending=${r.pending || '-'} node=${r.node} shr=${r.shr || '-'} archived=${r.archived || '-'} | ${keyCols.filter((c) => !['单据编号'].includes(c)).map((c) => c + '=' + JSON.stringify(r[c])).filter((x) => !/=null$|=undefined$|=""$/.test(x)).join(' ')}`)
    // 已存在流程链
    const links = await db.q(
      `SELECT source_panel_code, target_panel_code, target_form_no, link_status FROM form_flow_link
        WHERE source_form_no='${qs(r.no)}' OR target_form_no='${qs(r.no)}'`)
    if (links.length) console.log('    form_flow_link:', JSON.stringify(links))
    // 明细关键列分布
    const detCols = (await db.q(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t.detail}' ORDER BY ORDINAL_POSITION`)).map((c) => c.COLUMN_NAME)
    const judge = detCols.find((c) => /^(判定|结果判断|检验结果|结论)$/.test(c)) || detCols.find((c) => /判定|结论|结果/.test(c))
    if (judge) {
      const dist = await db.q(`SELECT [${judge}] v, COUNT(*) n FROM ${t.detail} WHERE 单据编号='${qs(r.no)}' GROUP BY [${judge}]`)
      console.log(`    明细[${judge}]分布:`, JSON.stringify(dist))
    }
  }
}

// QC_INSP 全量(而不是只草稿)看看已审核/审批中样本
const inspAll = await db.q(`SELECT TOP 20 h.单据编号 no, h.单据日期, ISNULL(s.pending,'') pending, ISNULL(CAST(s.approve_node AS varchar(5)),'') node, ISNULL(s.shr,'') shr, ISNULL(s.pending_by,'') pending_by,
  (SELECT COUNT(*) FROM qc_insp_detail d WHERE d.单据编号=h.单据编号) det
  FROM qc_insp h LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
  WHERE ISNULL(h.asp_cancel,'N') <> 'Y' ORDER BY h.单据编号 DESC`)
out.qc_insp_all = inspAll
console.log('\n[QC_INSP 最近 20 张]')
for (const r of inspAll) console.log(`- ${r.no} 明细=${r.det} pending=${r.pending || '-'} node=${r.node} shr=${r.shr || '-'}`)

await saveJson(path.join(EVIDENCE, 'probe2-' + nowStamp() + '.json'), out)
await db.close()
console.log('\nDONE probe2')
