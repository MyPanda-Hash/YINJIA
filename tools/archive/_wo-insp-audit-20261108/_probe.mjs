/**
 * _probe.mjs —— 环境/元数据/草稿盘点(只读,不写业务数据)
 *
 * 输出:
 *   ① yj_panel 中 5 张检验面板的元数据(表名/按钮组/审批相关配置)
 *   ② yj_field 字段数(表头/明细)与关键字段(单据状态/编号)
 *   ③ 每张面板在测试库的**现有草稿**清单(头表有行、yj_doc_status 无 pending/shr 记录)
 *   ④ yj_doc_status 里各面板的状态分布
 *
 * 用法: node tools/archive/_wo-insp-audit-20261108/_probe.mjs
 */
import path from 'node:path'
import {
  ROOT, ABS_HARNESS, login, api, openTestDb, qs, S, saveJson, nowStamp, EVIDENCE,
} from './_lib.mjs'

const BASE = process.env.YJ_BASE || 'http://127.0.0.1:8090'
const PANELS = ['QC_FIRST_INSP', 'QC_PROC_INSP', 'QC_ASM_INSP', 'QC_OQC_REPORT', 'QC_INSP']
const out = { base: BASE, at: new Date().toISOString(), panels: {}, tables: {}, drafts: {}, statusDist: {} }

const db = await openTestDb()
// 库名硬闸门复核
const dbName = (await db.one('SELECT DB_NAME() AS db')).db
if (dbName !== 'HSDZ_MES_TEST') throw new Error('拒绝:非测试库 ' + dbName)
console.log('[db]', dbName)

// ① yj_panel 结构 + 5 面板行
const cols = await db.q(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_panel' ORDER BY ORDINAL_POSITION`)
out.tables.yj_panel = cols.map((c) => c.COLUMN_NAME)
console.log('[yj_panel 列]', out.tables.yj_panel.join(','))

const panelRows = await db.q(
  `SELECT * FROM yj_panel WHERE panel_code IN (${PANELS.map((p) => `'${p}'`).join(',')})`)
out.tables.yj_panel_rows = panelRows
console.log('[yj_panel]', JSON.stringify(panelRows, null, 1).slice(0, 4000))

// ② 需要哪些物理表:从 yj_panel 里猜列名(含 table 的列)
const tableCols = out.tables.yj_panel.filter((c) => /table/i.test(c))
console.log('[可能的物理表列]', tableCols.join(','))

// ③ 面板元数据 API(按钮组)
const { token, user } = await login(BASE, { factory: 'YJ_TEST', userName: 'admin', password: '123456' })
const cli = api(BASE, token)
out.user = { userName: user.userName, realName: user.realName, isAdmin: user.isAdmin, approvePanels: user.approvePanels }
for (const p of PANELS) {
  try {
    const cfg = (await cli.getJson('/api/px/getPanelConfig?panelCode=' + p)).data || {}
    const meta = cfg.metadata || {}
    out.panels[p] = {
      name: meta.panelName,
      headTable: meta.headTable || meta.tableName || null,
      buttonGroups: meta.buttonGroups,
      dataSchemaFieldCount: (cfg.dataSchema?.fields || []).length,
      fields: (cfg.dataSchema?.fields || []).map((f) => f.dataName),
      detailTabs: (cfg.detail?.tabs || []).map((t) => t.name),
    }
    console.log(`[panel ${p}] name=${meta.panelName} headTable=${out.panels[p].headTable} buttons=${JSON.stringify(meta.buttonGroups)}`)
  } catch (e) {
    out.panels[p] = { error: String(e.message).slice(0, 300) }
    console.log(`[panel ${p}] ERROR ${e.message}`)
  }
}

// ④ 每面板物理表草稿盘点:先猜表名
const guess = {
  QC_FIRST_INSP: ['qc_first_insp_head', 'qc_first_insp_detail'],
  QC_PROC_INSP: ['qc_proc_insp_head', 'qc_proc_insp_detail'],
  QC_ASM_INSP: ['qc_asm_insp_head', 'qc_asm_insp_detail'],
  QC_OQC_REPORT: ['qc_oqc_head', 'qc_oqc_detail'],
  QC_INSP: ['qc_insp_head', 'qc_insp_detail'],
}
for (const p of PANELS) {
  const [head, detail] = guess[p]
  const exists = await db.one(
    `SELECT COUNT(*) n FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('${qs(head)}','${qs(detail)}')`)
  out.drafts[p] = { headTable: head, detailTable: detail, tablesExist: exists.n }
  if (exists.n === 0) { console.log(`[draft ${p}] 表不存在: ${head}/${detail}`); continue }
  // 列:单据编号/状态列
  const headCols = await db.q(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${qs(head)}' ORDER BY ORDINAL_POSITION`)
  out.drafts[p].headCols = headCols.map((c) => c.COLUMN_NAME)
  // 统计总行数
  const cnt = await db.one(`SELECT COUNT(*) n FROM ${head}`)
  out.drafts[p].headCount = cnt.n
  // 草稿 = 头表存在 + (无 yj_doc_status 行 或 该行 pending<>'Y' 且 shr 为空)
  const draftRows = await db.q(`
    SELECT TOP 30 h.单据编号 no,
           ISNULL(CAST(s.pending AS varchar(5)),'(无状态行)') pending,
           ISNULL(CAST(s.approve_node AS varchar(5)),'') node,
           ISNULL(s.shr,'') shr, ISNULL(s.pending_by,'') pending_by,
           CAST(s.pending_at AS varchar(30)) pending_at, CAST(s.update_at AS varchar(30)) update_at
      FROM ${head} h
      LEFT JOIN yj_doc_status s ON s.panel_code='${p}' AND s.doc_no=h.单据编号
     WHERE ISNULL(h.asp_cancel,'N') <> 'Y'
       AND (s.doc_no IS NULL OR (ISNULL(s.pending,'') <> 'Y' AND ISNULL(s.shr,'') = '' AND ISNULL(s.archived,'') = ''))
     ORDER BY h.单据编号 DESC`)
  out.drafts[p].drafts = draftRows
  console.log(`[draft ${p}] 总行=${cnt.n} 草稿=${draftRows.length}(最多列 30) 编号=${draftRows.map((r) => `${r.no}/${r.pending}${r.node ? '/n' + r.node : ''}`).join(', ')}`)
}

// ⑤ yj_doc_status 状态分布(这些面板)
const dist = await db.q(`
  SELECT panel_code,
         COUNT(*) total,
         SUM(CASE WHEN ISNULL(pending,'')='Y' AND ISNULL(CAST(approve_node AS varchar(5)),'') IN ('','1') THEN 1 ELSE 0 END) pending1,
         SUM(CASE WHEN ISNULL(pending,'')='Y' AND CAST(approve_node AS varchar(5))='2' THEN 1 ELSE 0 END) pending2,
         SUM(CASE WHEN ISNULL(pending,'')<>'Y' AND ISNULL(shr,'')<>'' THEN 1 ELSE 0 END) audited,
         SUM(CASE WHEN ISNULL(pending,'')<>'Y' AND ISNULL(shr,'')='' THEN 1 ELSE 0 END) draftish
    FROM yj_doc_status
   WHERE panel_code IN (${PANELS.map((p) => `'${p}'`).join(',')})
   GROUP BY panel_code`)
out.statusDist = dist
console.log('[yj_doc_status 分布]', JSON.stringify(dist))

// ⑥ 测试库角色审批权(admin 是超级管理员,直审也放行;记录一下 QC_INSP 等)
const rolePerms = await db.q(`
  SELECT rp.panel_code, r.id role_id, r.role_name, rp.can_approve
    FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
   WHERE rp.panel_code IN (${PANELS.map((p) => `'${p}'`).join(',')}) AND ISNULL(rp.can_approve,'')='Y'`)
out.rolePerms = rolePerms
console.log('[审批权]', JSON.stringify(rolePerms))

await saveJson(path.join(EVIDENCE, 'probe-' + nowStamp() + '.json'), out)
await db.close()
console.log('\nDONE probe')
