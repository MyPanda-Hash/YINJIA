/** 临时只读:按后端 docStatusOf 口径给 5 张检验面板的全部单据分类,列出真草稿 */
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
  const rows = await db.q(`
    SELECT h.单据编号 no, ISNULL(h.asp_cancel,'N') hcancel,
           s.doc_no sid, ISNULL(s.pending,'-') pending, ISNULL(CAST(s.approve_node AS varchar(5)),'') node,
           ISNULL(s.shr,'') shr, ISNULL(s.canceled,'') canceled, ISNULL(s.stopped,'') stopped,
           ISNULL(s.archived,'') archived, ISNULL(s.deleting,'') deleting, ISNULL(s.modify_state,'') modst,
           ISNULL(s.effective,'') eff, ISNULL(s.erp_close_state,'') erp,
           (SELECT COUNT(*) FROM ${t === 'qc_insp' ? 'qc_insp_detail' : t.replace('_head', '_detail')} d WHERE d.单据编号=h.单据编号) det,
           CAST(h.单据日期 AS varchar(20)) dt
      FROM ${t} h LEFT JOIN yj_doc_status s ON s.panel_code='${panel}' AND s.doc_no=h.单据编号
     WHERE ISNULL(h.asp_cancel,'N') <> 'Y'
     ORDER BY h.单据编号 DESC`)
  const cls = (r) => {
    if (r.sid === null) return '草稿(无状态行)'
    if (r.hcancel === 'Y' || r.canceled === 'Y') return '已作废'
    if (r.stopped === 'Y') return '已中止'
    if (r.erp === 'H') return '已中止(ERP)'
    if (r.deleting === 'Y') return '删除申请中'
    if (r.modst === 'R') return '修改申请中'
    if (r.pending === 'Y') return r.node === '2' ? '待二级审批' : '审批中'
    if (r.modst === 'Y') return '修改中'
    if (r.eff === 'Y') return '已生效'
    if (r.archived === 'Y') return '已归档'
    if (r.erp === 'S') return '已完成'
    if (r.shr) return '已审核(shr=' + r.shr + ')'
    return '草稿'
  }
  const buckets = {}
  for (const r of rows) { const k = cls(r); (buckets[k] ||= []).push(r) }
  console.log(`\n===== ${panel} 共 ${rows.length} 张 =====`)
  for (const [k, list] of Object.entries(buckets)) {
    console.log(`[${k}] ${list.length} 张: ${list.slice(0, 8).map((r) => `${r.no}(明细${r.det}${r.node ? ',node' + r.node : ''})`).join(', ')}${list.length > 8 ? ' …' : ''}`)
  }
}
await db.close()
