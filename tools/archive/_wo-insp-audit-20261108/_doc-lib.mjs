/**
 * _doc-lib.mjs —— 单据状态/快照/整行还原 公共件(2026-11-08 5 张检验单据审核反审核验证)
 *
 * 被 `_e2e-audit-unaudit.mjs`(API 全流程)与 `_ui-restore.mjs`(ego 浏览器点完之后的清场)共用。
 * 口径:
 *   · deriveStatus = 复刻 ButtonService.docStatusOf(yj_doc_status → 单据状态);
 *   · snapshot / cleanupAndRestore = 测前整行快照,测后删下游测试单 + 逐列 diff 还原头/明细/状态行/流程链;
 *   · **只写测试账套**(调用方负责 openTestDb + DB_NAME() 校验)。
 */
import { S } from './_lib.mjs'

/* ───────────────────────── 5 张检验面板配置 ───────────────────────── */
/** l2=true ⇒ 质量单据两级审批(ButtonService.ADMIN_L2_PANELS);false ⇒ 单节点审批 */
export const PANELS = [
  {
    code: 'QC_FIRST_INSP', name: '首件检验单', l2: true,
    head: 'qc_first_insp_head', detail: 'qc_first_insp_detail',
    candidates: ['SJ-2026-10-0153', 'SJ-2026-10-0152', 'SJ-2026-10-0160', 'SJ-2026-10-0133'],
    // 纸面底部「编制/审核/批准」三格绑的列(QC_DOC_PREPARER 登记)
    sign: { prep: '检验员', l1: '审核人', l1Time: '审核时间', l2: '审批人', l2Time: '审批时间' },
    downstreamPanels: [],
  },
  {
    code: 'QC_PROC_INSP', name: '制程检验单', l2: true,
    head: 'qc_proc_insp_head', detail: 'qc_proc_insp_detail',
    candidates: ['ZC-2026-10-0126', 'ZC-2026-10-0033', 'ZC-2026-10-0032'],
    sign: { prep: '检验员', l1: '审核人', l1Time: '审核时间', l2: '审批人', l2Time: '审批时间' },
    downstreamPanels: [],
  },
  {
    code: 'QC_OQC_REPORT', name: '出厂检验报告', l2: true,
    head: 'qc_oqc_head', detail: 'qc_oqc_detail',
    candidates: ['OQC-2026-11-0012', 'OQC-2026-11-0003', 'OQC-2026-11-0004'],
    sign: { prep: '检验员', l1: '审核人', l1Time: '审核时间', l2: '审批人', l2Time: '审批时间' },
    downstreamPanels: [],
  },
  {
    code: 'QC_ASM_INSP', name: '组装成品检验单', l2: false,
    head: 'qc_asm_insp_head', detail: 'qc_asm_insp_detail',
    candidates: ['ZJ-2026-10-0135', 'ZJ-2026-10-0096'],
    sign: null, // 不在 QC_DOC_PREPARER:审批不写纸面签署格(审核人取 yj_doc_status.shr 虚拟字段)
    downstreamPanels: ['FINISH_IN'], // 审核 → 按表头「合格数量」自动生成产成品入库单草稿
  },
  {
    code: 'QC_INSP', name: '来料检验单', l2: false,
    head: 'qc_insp', detail: 'qc_insp_detail',
    candidates: ['IJ-2026-09-0152'],
    sign: null,
    downstreamPanels: ['PURCHASE_IN', 'QC_RETURN'],
  },
]
export const panelCfg = (code) => PANELS.find((p) => p.code === code) || null

/* ───────────────────────── SQL 助手 ───────────────────────── */
const colCache = new Map()
export async function tableCols(db, table) {
  if (!colCache.has(table)) {
    const rows = await db.q(`SELECT COLUMN_NAME name, DATA_TYPE type FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${String(table).replace(/'/g, "''")}' ORDER BY ORDINAL_POSITION`)
    colCache.set(table, rows)
  }
  return colCache.get(table)
}
export async function scalar(db, sql, params = []) {
  const req = db.pool.request()
  params.forEach((p, i) => req.input('p' + i, p))
  const r = await req.query(sql.replace(/@q(\d+)/g, (_, i) => '@p' + i))
  return r.recordset[0] ? r.recordset[0].v : null
}
export async function rowsQ(db, sql, params = []) {
  const req = db.pool.request()
  params.forEach((p, i) => req.input('q' + i, p))
  return (await req.query(sql)).recordset
}
export async function rowByKey(db, table, keyCol, keyVal) {
  const r = await db.pool.request().input('k', keyVal).query(`SELECT * FROM [${table}] WHERE [${keyCol}] = @k`)
  return r.recordset[0] || null
}
export async function rowsByKey(db, table, keyCol, keyVal) {
  const r = await db.pool.request().input('k', keyVal).query(`SELECT * FROM [${table}] WHERE [${keyCol}] = @k ORDER BY id`)
  return r.recordset
}
export async function deleteWhere(db, table, whereSql, params = []) {
  const req = db.pool.request()
  params.forEach((p, i) => req.input('q' + i, p))
  const r = await req.query(`DELETE FROM [${table}] WHERE ${whereSql}`)
  return r.rowsAffected[0] || 0
}

/* ───────────────────────── 值比较 / 整行还原 ───────────────────────── */
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
export const valKey = (v) => {
  if (v === null || v === undefined) return 'null'
  if (v instanceof Date) return 'date:' + v.getTime()
  if (Buffer.isBuffer(v)) return 'buf:' + v.toString('hex')
  // 快照经 JSON 往返后日期会退化成 ISO 串(或列本身存 ISO 串)——按同一时间点比较
  if (typeof v === 'string' && ISO_RE.test(v)) return 'date:' + new Date(v).getTime()
  return typeof v === 'number' ? 'num:' + v : 'val:' + String(v)
}
/** Date 允许 ≤5ms 舍入误差(datetime 3.33ms / datetime2 精度差异) */
export function sameVal(a, b) {
  if (a instanceof Date && b instanceof Date) return Math.abs(a.getTime() - b.getTime()) <= 5
  if (a instanceof Date && typeof b === 'string' && ISO_RE.test(b)) return Math.abs(a.getTime() - new Date(b).getTime()) <= 5
  if (b instanceof Date && typeof a === 'string' && ISO_RE.test(a)) return Math.abs(b.getTime() - new Date(a).getTime()) <= 5
  return valKey(a) === valKey(b)
}
const exNull = (v) => (v === undefined ? null : v)
const DATE_TYPES = new Set(['date', 'datetime', 'datetime2', 'smalldatetime', 'datetimeoffset'])
/** 快照值 → SQL 参数值:日期类列遇到 ISO 串要转 Date(逐列 diff 还原的健壮性) */
function paramOf(colMeta, v) {
  if (v === null || v === undefined) return null
  if (DATE_TYPES.has(String(colMeta.type).toLowerCase()) && typeof v === 'string' && ISO_RE.test(v)) return new Date(v)
  return v
}

/** 整行还原:按主键读回,逐列 diff(跳过 id/rowversion),只更新差异列,再复核 */
export async function restoreRow(db, table, snap, keyCol) {
  if (!snap) return { table, restored: true, skipped: '无快照' }
  const cur = await rowByKey(db, table, keyCol, snap[keyCol])
  if (!cur) return { table, key: snap[keyCol], restored: false, reason: '原行不存在' }
  const cols = (await tableCols(db, table)).filter((c) => c.name !== 'id' && !/timestamp|rowversion/i.test(c.type))
  const diffs = cols.filter((c) => !sameVal(cur[c.name], snap[c.name]))
  if (!diffs.length) return { table, key: snap[keyCol], restored: true, changed: [] }
  const req = db.pool.request().input('k', snap[keyCol])
  diffs.forEach((c, i) => req.input('p' + i, paramOf(c, snap[c.name])))
  await req.query(`UPDATE [${table}] SET ${diffs.map((c, i) => `[${c.name}] = @p${i}`).join(', ')} WHERE [${keyCol}] = @k`)
  const after = await rowByKey(db, table, keyCol, snap[keyCol])
  const still = cols.filter((c) => !sameVal(after[c.name], snap[c.name])).map((c) => c.name)
  return { table, key: snap[keyCol], restored: !still.length, changed: diffs.map((c) => c.name), stillDiff: still }
}

/* ───────────────────────── 状态 / 留痕 ───────────────────────── */
/** 复刻 ButtonService.docStatusOf 的状态推导(权威口径) */
export function deriveStatus(row) {
  if (!row) return '草稿'
  const y = (v) => String(v ?? '').toUpperCase() === 'Y'
  const node = row.approve_node === null || row.approve_node === undefined ? 1 : Number(row.approve_node)
  if (y(row.canceled)) return '已作废'
  if (y(row.stopped)) return '已中止'
  if (String(row.erp_close_state ?? '').toUpperCase() === 'H') return '已中止'
  if (y(row.deleting)) return '删除申请中'
  if (String(row.modify_state ?? '') === 'R') return '修改申请中'
  if (y(row.pending)) return node === 2 ? '待二级审批' : '审批中'
  if (y(row.modify_state)) return '修改中'
  if (y(row.effective)) return '已生效'
  if (y(row.archived)) return '已归档'
  if (String(row.erp_close_state ?? '').toUpperCase() === 'S') return '已完成'
  if (row.shr !== null && row.shr !== undefined) return '已审核'
  return '草稿'
}
export async function docStatus(db, panel, no) {
  const r = await db.pool.request().input('p', panel).input('n', no)
    .query('SELECT * FROM yj_doc_status WHERE panel_code=@p AND doc_no=@n')
  const row = r.recordset[0] || null
  return { status: deriveStatus(row), row }
}
export async function approvals(db, panel, no) {
  return rowsQ(db, 'SELECT id, action, result, node_no, operator, opinion, self_audit FROM yj_form_approval WHERE panel_code=@q0 AND form_no=@q1 ORDER BY id', [panel, no])
}
export const S_ = (v) => (v === null || v === undefined ? '' : String(v).trim())

/* ───────────────────────── 快照 / 还原 ───────────────────────── */
export async function snapshot(db, P, no) {
  const head = await rowByKey(db, P.head, '单据编号', no)
  const detail = await rowsByKey(db, P.detail, '单据编号', no)
  const stRow = (await rowsQ(db, 'SELECT * FROM yj_doc_status WHERE panel_code=@q0 AND doc_no=@q1', [P.code, no]))[0] || null
  const maxAppr = Number(await scalar(db, 'SELECT ISNULL(MAX(id),0) v FROM yj_form_approval'))
  const maxMsg = Number(await scalar(db, 'SELECT ISNULL(MAX(id),0) v FROM yj_message'))
  const links = await rowsQ(db, 'SELECT * FROM form_flow_link WHERE source_form_no=@q0 OR target_form_no=@q0 ORDER BY id', [no])
  const downstreamTables = {}
  for (const dp of P.downstreamPanels || []) {
    downstreamTables[dp] = (await rowsQ(db, 'SELECT panel_code, head_table, line_table FROM yj_panel WHERE panel_code=@q0', [dp]))[0] || null
  }
  let workOrders = []
  if (P.code === 'QC_ASM_INSP' && head && S_(head['工单号'])) {
    workOrders = await rowsQ(db, 'SELECT * FROM plang WHERE pl_no=@q0 ORDER BY id', [S_(head['工单号'])])
  }
  return { head, detail, stRow, maxAppr, maxMsg, links, downstreamTables, workOrders, savedAt: new Date().toISOString(), panel: P.code, docNo: no }
}

/** 找出本轮审核**新生成**的下游单号(该面板 → 目标面板,且不在测前流程链里的 target) */
export async function newDownstream(db, P, no, pre) {
  const out = {}
  for (const dp of P.downstreamPanels || []) {
    const links = await rowsQ(db,
      'SELECT target_form_no FROM form_flow_link WHERE source_panel_code=@q0 AND source_form_no=@q1 AND target_panel_code=@q2',
      [P.code, no, dp])
    const preTargets = new Set(pre.links
      .filter((l) => S_(l.source_form_no) === no && S_(l.target_panel_code) === dp)
      .map((l) => S_(l.target_form_no)))
    out[dp] = [...new Set(links.map((l) => S_(l.target_form_no)).filter((x) => x && !preTargets.has(x)))]
  }
  return out
}

/**
 * 还原:删下游测试单 → 恢复流程链 → 头行/明细整行还原 → 状态行还原/删除 → 删本轮审批留痕/消息 → 复核。
 * ⚠ 只允许把「本轮新增/改动」还原成 pre 快照;不动 pre 之外的任何数据。
 */
export async function cleanupAndRestore(db, P, no, pre, downs) {
  const report = { downstreamDeleted: {}, links: {}, restored: {}, residue: {} }
  for (const [dp, nos] of Object.entries(downs)) {
    const t = pre.downstreamTables[dp]
    report.downstreamDeleted[dp] = []
    if (!t || !nos.length) continue
    for (const dNo of nos) {
      const d = {}
      d.line = await deleteWhere(db, t.line_table, '单据编号=@q0', [dNo])
      d.head = await deleteWhere(db, t.head_table, '单据编号=@q0', [dNo])
      d.status = await deleteWhere(db, 'yj_doc_status', 'doc_no=@q0', [dNo])
      d.approval = await deleteWhere(db, 'yj_form_approval', 'form_no=@q0', [dNo])
      d.message = await deleteWhere(db, 'yj_message', '单据编号=@q0', [dNo])
      d.links = await deleteWhere(db, 'form_flow_link', 'source_form_no=@q0 OR target_form_no=@q0', [dNo])
      report.downstreamDeleted[dp].push({ no: dNo, ...d })
    }
  }
  // 既有流程链:删除本轮新增行 + 恢复被改动的状态列
  const preIds = new Set(pre.links.map((l) => Number(l.id)))
  const curLinks = await rowsQ(db, 'SELECT * FROM form_flow_link WHERE source_form_no=@q0 OR target_form_no=@q0 ORDER BY id', [no])
  report.links.deleted = 0
  for (const l of curLinks) {
    if (!preIds.has(Number(l.id))) { await deleteWhere(db, 'form_flow_link', 'id=@q0', [Number(l.id)]); report.links.deleted++ }
  }
  report.links.restored = []
  for (const snap of pre.links) {
    const r = await restoreRow(db, 'form_flow_link', snap, 'id')
    if (!r.changed || r.changed.length) report.links.restored.push(r)
  }
  // 头行 / 明细整行还原
  report.restored.head = await restoreRow(db, P.head, pre.head, '单据编号')
  report.restored.detail = []
  const preDetailIds = new Set(pre.detail.map((r) => Number(r.id)))
  for (const r of await rowsByKey(db, P.detail, '单据编号', no)) {
    if (!preDetailIds.has(Number(r.id))) report.restored.detail.push({ id: Number(r.id), deleted: await deleteWhere(db, P.detail, 'id=@q0', [Number(r.id)]) })
  }
  for (const snap of pre.detail) report.restored.detail.push(await restoreRow(db, P.detail, snap, 'id'))
  // 工单行还原(ASM 结案重算)
  report.restored.workOrders = []
  for (const wo of pre.workOrders || []) report.restored.workOrders.push(await restoreRow(db, 'plang', wo, 'id'))
  // yj_doc_status
  if (pre.stRow) report.restored.status = await restoreRow(db, 'yj_doc_status', pre.stRow, 'id')
  else report.restored.status = { deleted: await deleteWhere(db, 'yj_doc_status', 'panel_code=@q0 AND doc_no=@q1', [P.code, no]) }
  // 本轮新增审批留痕 / 消息
  report.restored.approvalDeleted = await deleteWhere(db, 'yj_form_approval', 'panel_code=@q0 AND form_no=@q1 AND id>@q2', [P.code, no, pre.maxAppr])
  const msgNos = [no, ...Object.values(downs).flat()]
  {
    const req = db.pool.request().input('m', pre.maxMsg)
    msgNos.forEach((d, i) => req.input('d' + i, d))
    const r = await req.query(`DELETE FROM yj_message WHERE id>@m AND 单据编号 IN (${msgNos.map((_, i) => '@d' + i).join(',')})`)
    report.restored.messageDeleted = r.rowsAffected[0] || 0
  }
  // 复核
  const afterSt = await docStatus(db, P.code, no)
  const afterHead = await rowByKey(db, P.head, '单据编号', no)
  const headCols = (await tableCols(db, P.head)).filter((c) => c.name !== 'id')
  report.residue = {
    statusAfter: afterSt.status,
    statusRowAfter: afterSt.row,
    headDiff: headCols.filter((c) => !sameVal(afterHead[c.name], pre.head[c.name])).map((c) => c.name),
    approvalLeft: Number(await scalar(db,
      'SELECT COUNT(*) v FROM yj_form_approval WHERE panel_code=@q0 AND form_no=@q1 AND id>@q2', [P.code, no, pre.maxAppr])),
    downstreamLeft: {},
    linkCountNow: Number(await scalar(db, 'SELECT COUNT(*) v FROM form_flow_link WHERE source_form_no=@q0 OR target_form_no=@q0', [no])),
    linkCountPre: pre.links.length,
    statusRowRestored: !!(pre.stRow ? (await restoreRow(db, 'yj_doc_status', pre.stRow, 'id')).restored : true),
  }
  for (const [dp, nos] of Object.entries(downs)) {
    const t = pre.downstreamTables[dp]
    if (!t) continue
    let n = 0
    for (const dNo of nos) n += Number(await scalar(db, `SELECT COUNT(*) v FROM ${t.head_table} WHERE 单据编号=@q0`, [dNo]))
    report.residue.downstreamLeft[dp] = n
  }
  return report
}
