/**
 * _db-snapshot.mjs —— 2026-11-06 三项需求的**只读**数据库基线/复核快照
 *
 * 对两个账套各拍一份(HSDZ_MES 正式 = 只读;HSDZ_MES_TEST 测试 = 允许写,但本脚本不写):
 *   · yj_panel / yj_field(QC_PROC_INSP、QC_FIRST_INSP、QC_OQC_REPORT 全字段)
 *   · yj_role_panel 审批权(can_approve)+ 角色/用户;各账号实际审批权推导
 *   · 三张单的物理数据现状(计数/工序 有值行数/检验方案 值分布/结果判断 值分布/审批列)
 *
 * 用法:
 *   node tools/archive/_qc-insp-verify-20261106/_db-snapshot.mjs --tag=before
 *   node tools/archive/_qc-insp-verify-20261106/_db-snapshot.mjs --tag=after
 *   产物:evidence/stage1/db-snapshot-<tag>-<时间戳>.{json,txt}
 *   只读,不依赖 8091 是否在跑。
 */
import fs from 'node:fs'
import path from 'node:path'
import { dbConnect, evidenceDir, saveJson, saveText, nowStamp } from './_lib.mjs'

const args = process.argv.slice(2)
const arg = (n, d) => {
  const eq = args.find((a) => a.startsWith('--' + n + '='))
  if (eq) return eq.slice(n.length + 3)
  const i = args.indexOf('--' + n)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const TAG = String(arg('tag', 'before'))
const STAMP = nowStamp()
const PANELS = ['QC_PROC_INSP', 'QC_FIRST_INSP', 'QC_OQC_REPORT']
const PANEL_IN = PANELS.map((p) => `'${p}'`).join(',')

async function snapOne(dbName) {
  const db = await dbConnect(dbName)
  const out = { database: dbName }
  try {
    out.dbName = (await db.one('SELECT DB_NAME() AS db')).db
    out.panels = await db.q(
      `SELECT panel_code, panel_name, mode, head_table, line_table FROM yj_panel WHERE panel_code IN (${PANEL_IN})`)
    out.fields = await db.q(
      `SELECT panel_code, seq, place, col_name, label, data_type, ISNULL(dict_sql,'') dict_sql,
              editable, required, hidden, visible
         FROM yj_field WHERE panel_code IN (${PANEL_IN})
        ORDER BY panel_code, seq, id`)
    // 审批权:分两条简单查询在 JS 里合并(避免一条复杂 JOIN 在旧客户端上的列解析坑)
    const rp = await db.q(
      `SELECT panel_code, role_id, can_approve, ISNULL(perms,'') perms FROM yj_role_panel WHERE panel_code IN (${PANEL_IN})`)
    const roles = await db.q('SELECT id, role_code, role_name, is_admin FROM yj_role ORDER BY id')
    const users = await db.q(
      `SELECT username, real_name, is_admin, role_id, enabled FROM yj_user ORDER BY role_id, username`)
    const roleById = new Map(roles.map((r) => [r.id, r]))
    const usersByRole = new Map()
    for (const u of users) {
      const k = String(u.role_id)
      if (!usersByRole.has(k)) usersByRole.set(k, [])
      usersByRole.get(k).push(u)
    }
    out.roles = roles
    out.users = users.map((u) => ({ ...u, role_code: roleById.get(u.role_id)?.role_code || '', role_name: roleById.get(u.role_id)?.role_name || '' }))
    out.rolePanels = rp.map((r) => ({
      ...r,
      role_code: roleById.get(r.role_id)?.role_code || '',
      role_name: roleById.get(r.role_id)?.role_name || '',
      users_enabled: (usersByRole.get(String(r.role_id)) || []).filter((u) => u.enabled !== 0 && u.enabled !== false).length,
    })).sort((a, b) => (a.panel_code + String(a.role_id)).localeCompare(b.panel_code + String(b.role_id)))
    out.approverRoles = out.rolePanels.filter((r) => r.can_approve === 'Y')
    // 目标账号(任务点名 + 一层兜底)
    const targets = ['admin', 'fm', 'cmj', 'TANCHENG', 'WANGGUANGZHEN', 'cs', 'cp', 'chaishanyin', 'chenxiuli', 'fengmin', 'wangguangzhen']
    const approveByPanel = new Map()
    for (const r of out.approverRoles) approveByPanel.set(r.panel_code, (approveByPanel.get(r.panel_code) || new Set()).add(r.role_id))
    out.targetUsers = targets.map((un) => {
      const u = out.users.find((x) => String(x.username).toLowerCase() === un.toLowerCase())
      if (!u) return { username: un, exists: false }
      return {
        username: u.username, real_name: u.real_name, role_id: u.role_id, role_name: u.role_name,
        PROC_approve: (approveByPanel.get('QC_PROC_INSP') || new Set()).has(u.role_id) ? 1 : 0,
        FIRST_approve: (approveByPanel.get('QC_FIRST_INSP') || new Set()).has(u.role_id) ? 1 : 0,
      }
    })
    // —— 物理数据现状 ——
    out.tables = {}
    for (const t of ['qc_proc_insp_head', 'qc_proc_insp_detail', 'qc_first_insp_head', 'qc_first_insp_detail', 'qc_oqc_head', 'qc_oqc_detail']) {
      try {
        out.tables[t] = { count: (await db.one(`SELECT COUNT(*) n FROM dbo.${t}`)).n }
      } catch (e) { out.tables[t] = { error: String(e.message).slice(0, 160) } }
    }
    out.approvalCols = {}
    for (const t of ['qc_proc_insp_head', 'qc_first_insp_head', 'qc_oqc_head']) {
      try {
        out.approvalCols[t] = (await db.q(
          `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${t}')
             AND (name LIKE '%审核%' OR name LIKE '%审批%' OR name LIKE '%检验员%')`)).map((x) => x.name)
      } catch (e) { out.approvalCols[t] = { error: String(e.message).slice(0, 160) } }
    }
    try {
      out.proc = {
        工序列存在: (await db.one("SELECT COUNT(*) n FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_proc_insp_head') AND name=N'工序'")).n,
        工序有值行数: (await db.one("SELECT COUNT(*) n FROM qc_proc_insp_head WHERE LTRIM(RTRIM(ISNULL(工序,''))) <> ''")).n,
        检验方案分布: await db.q("SELECT ISNULL(检验方案,'(空)') v, COUNT(*) n FROM qc_proc_insp_head GROUP BY ISNULL(检验方案,'(空)') ORDER BY n DESC"),
        结果判断分布: await db.q("SELECT ISNULL(结果判断,'(空)') v, COUNT(*) n FROM qc_proc_insp_detail GROUP BY ISNULL(结果判断,'(空)') ORDER BY n DESC"),
        明细行数: (await db.one('SELECT COUNT(*) n FROM qc_proc_insp_detail')).n,
      }
    } catch (e) { out.proc = { error: String(e.message).slice(0, 300) } }
    try {
      out.docStatus = await db.q(
        `SELECT panel_code, ISNULL(pending,'') pending, COUNT(*) n FROM yj_doc_status
          WHERE panel_code IN (${PANEL_IN}) GROUP BY panel_code, ISNULL(pending,'')`)
    } catch (e) { out.docStatus = { error: String(e.message).slice(0, 160) } }
    out.draftCandidates = {}
    for (const [pc, t] of [['QC_PROC_INSP', 'qc_proc_insp_head'], ['QC_FIRST_INSP', 'qc_first_insp_head'], ['QC_OQC_REPORT', 'qc_oqc_head']]) {
      try {
        out.draftCandidates[pc] = await db.q(
          `SELECT TOP 3 h.单据编号, ISNULL(d.pending,'') pending, ISNULL(d.shr,'') shr
             FROM ${t} h LEFT JOIN yj_doc_status d ON d.panel_code='${pc}' AND d.doc_no=h.单据编号
            WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(d.pending,'N') = 'N' AND ISNULL(d.shr,'') = ''
            ORDER BY h.单据编号 DESC`)
      } catch (e) { out.draftCandidates[pc] = { error: String(e.message).slice(0, 160) } }
    }
  } finally {
    await db.close()
  }
  return out
}

const t0 = Date.now()
const snapshot = { tag: TAG, stamp: STAMP, when: new Date().toISOString(), prod: null, test: null }
snapshot.prod = await snapOne('HSDZ_MES')
snapshot.test = await snapOne('HSDZ_MES_TEST')
snapshot.elapsedMs = Date.now() - t0

const dir = evidenceDir('stage1')
const jsonFile = path.join(dir, `db-snapshot-${TAG}-${STAMP}.json`)
await saveJson(jsonFile, snapshot)

const L = []
const summary = (label, s) => {
  L.push(`\n================ ${label} / DB=${s.dbName} ================`)
  L.push(`[面板] ${JSON.stringify(s.panels)}`)
  L.push('[目标字段]')
  for (const f of s.fields) {
    const interesting = ['工序', '检验方案', '结果判断', '产品编码', '检验员', '审核人', '审核时间', '审批人', '审批时间', '单据编号'].includes(f.label)
    if (interesting) L.push(`  ${f.panel_code}\t${f.label}\ttype=${f.data_type}\teditable=${f.editable}\thidden=${f.hidden}\tvisible=${f.visible}\tseq=${f.seq}\tdict=${f.dict_sql}`)
  }
  L.push('[审批权 can_approve=Y 的面板×角色]')
  for (const r of s.approverRoles) L.push(`  ${r.panel_code}\trole=${r.role_id}/${r.role_code}/${r.role_name}\tusers_enabled=${r.users_enabled}\tperms=${r.perms}`)
  L.push('[目标账号审批权]')
  for (const u of s.targetUsers) L.push(`  ${JSON.stringify(u)}`)
  L.push(`[物理数据] ${JSON.stringify(s.tables)}`)
  L.push(`[审批列] ${JSON.stringify(s.approvalCols)}`)
  L.push(`[制程单 工序/检验方案/结果判断] ${JSON.stringify(s.proc)}`)
  L.push(`[单据状态] ${JSON.stringify(s.docStatus)}`)
  L.push(`[草稿候选] ${JSON.stringify(s.draftCandidates)}`)
}
summary('正式库 HSDZ_MES(只读)', snapshot.prod)
summary('测试库 HSDZ_MES_TEST', snapshot.test)
const txtFile = path.join(dir, `db-snapshot-${TAG}-${STAMP}.txt`)
await saveText(txtFile, `2026-11-06 三项需求 DB 快照 tag=${TAG} stamp=${STAMP} elapsed=${snapshot.elapsedMs}ms\n` + L.join('\n') + '\n')
console.log(`\n[done] ${jsonFile}`)
