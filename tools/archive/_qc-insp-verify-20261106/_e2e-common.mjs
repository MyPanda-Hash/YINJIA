/**
 * _e2e-common.mjs —— 三项需求 E2E 的公共件(2026-11-06 独立验证)
 *
 * 面板元数据/建单/状态查询/审批留痕/测试夹具(角色审批权)/按单号白名单清理。
 * ⚠ 所有写操作只在 HSDZ_MES_TEST;清理脚本带 DB_NAME() 硬闸门 + 单号白名单 + AUTO_ 标记复核。
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT, WRITE_DB, dbConnect, api, okCall, qs, saveJson, sleep, signToken,
} from './_lib.mjs'

/* ───────────────────────── 面板元数据 ───────────────────────── */
export const PANEL = {
  QC_PROC_INSP: {
    code: 'QC_PROC_INSP', name: '制程检验单',
    headTable: 'qc_proc_insp_head', detailTable: 'qc_proc_insp_detail',
    sheetSelector: '.qr-sheet',
    reportCode: 'qc_proc_insp',
    signCols: { prep: '检验员', l1: '审核人', l1Time: '审核时间', l2: '审批人', l2Time: '审批时间' },
    /** 纸面表尾:检验人 / 审核人 / 批准(2026-11-06 由 4 列改 6 列) */
    footLabels: { prep: '检验人', l1: '审核人', l2: '批准' },
    createHead: (marker, extra = {}) => ({
      单据日期: '2026-11-06', 工单号: 'AUTO_' + marker, 检验类别: '首件',
      批次号: 'AUTO-' + marker, 客户名称: 'AUTO_QCVER_' + marker,
      产品编码: 'AUTO-PROD-001', 产品名称: 'AUTO_验证产品', 规格型号: 'AUTO-SPEC',
      检验日期: '2026-11-06', 检验方案: '错误值_应被覆盖', ...extra,
    }),
    items: [
      { 表区: '', 行号: 1, 检验项目: 'AUTO_外观', 检验要求: '无破损', 检验方法: '目视', 产线常规功能性结果: '合格', 结果判断: '合格' },
      { 表区: '', 行号: 2, 检验项目: 'AUTO_尺寸', 检验要求: '公差内', 检验方法: '卡尺', 产线常规功能性结果: '合格', 结果判断: '合格' },
    ],
  },
  QC_FIRST_INSP: {
    code: 'QC_FIRST_INSP', name: '首件检验单',
    headTable: 'qc_first_insp_head', detailTable: 'qc_first_insp_detail',
    sheetSelector: '.fi-sheet',
    reportCode: 'qc_first_insp',
    signCols: { prep: '检验员', l1: '审核人', l1Time: '审核时间', l2: '审批人', l2Time: '审批时间' },
    footLabels: { prep: '检验人', l1: '审核人', l2: '批准' },
    createHead: (marker, extra = {}) => ({
      单据日期: '2026-11-06', 工单号: 'AUTO_' + marker, 批次号: 'AUTO-' + marker,
      客户名称: 'AUTO_QCVER_' + marker, 产品编码: 'AUTO-PROD-001', 产品名称: 'AUTO_验证产品',
      规格型号: 'AUTO-SPEC', 检验日期: '2026-11-06', 备注: 'AUTO_QCVER_' + marker, ...extra,
    }),
    items: [],
  },
  QC_OQC_REPORT: {
    code: 'QC_OQC_REPORT', name: '出厂检验报告',
    headTable: 'qc_oqc_head', detailTable: 'qc_oqc_detail',
    sheetSelector: '.oqc-sheet',
    reportCode: 'qc_oqc',
    signCols: { prep: '检验员', l1: '审核人', l1Time: '审核时间', l2: '审批人', l2Time: '审批时间' },
    footLabels: { prep: '检验员', l1: '审 核', l2: '批 准' },
    createHead: (marker, extra = {}) => ({
      单据日期: '2026-11-06', 客户名称: 'AUTO_QCVER_' + marker, 产品名称: 'AUTO_验证产品',
      规格型号: 'AUTO-SPEC', 生产日期: '2026-11-05', 生产数量: 100, 检测日期: '2026-11-06',
      AQL: '0.65', 检验结论: '合格', 备注: 'AUTO_QCVER_' + marker, ...extra,
    }),
    items: [
      { 序号: 1, 检验项目: 'AUTO_外观', 检验要求: '无破损', 抽样标准: 'GB/T 2828.1', 抽检量: '5', 结果: '合格', 判定: '合格' },
      { 序号: 2, 检验项目: 'AUTO_尺寸', 检验要求: '公差内', 抽样标准: 'GB/T 2828.1', 抽检量: '5', 结果: '合格', 判定: '合格' },
    ],
  },
}

/* ───────────────────────── 参数解析 ───────────────────────── */
export function parseArgs() {
  const a = process.argv.slice(2)
  const arg = (n, d) => {
    const eq = a.find((x) => x.startsWith('--' + n + '='))
    if (eq) return eq.slice(n.length + 3)
    const i = a.indexOf('--' + n)
    return i >= 0 && a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : d
  }
  return { arg, args: a }
}

export function runId() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
}

/* ───────────────────────── DB 助手 ───────────────────────── */
/** 连测试库并断言库名(写操作硬前提) */
export async function openTestDb() {
  const db = await dbConnect(WRITE_DB)
  const name = (await db.one('SELECT DB_NAME() AS db')).db
  if (name !== WRITE_DB) {
    await db.close()
    throw new Error(`拒绝: 当前库 ${name} != ${WRITE_DB}(写操作只允许测试账套)`)
  }
  return db
}

export const S = (v) => (v === null || v === undefined ? '' : String(v).trim())

export async function docStatus(db, panel, no) {
  const row = await db.one(
    `SELECT ISNULL(pending,'') pending, ISNULL(CAST(approve_node AS varchar(10)),'') node,
            ISNULL(shr,'') shr, shsj, ISNULL(pending_by,'') pending_by
       FROM yj_doc_status WHERE panel_code='${panel}' AND doc_no='${qs(no)}'`)
  return row || { pending: '', node: '', shr: '', shsj: null, pending_by: '' }
}

export async function headSign(db, panel, no) {
  const P = PANEL[panel]
  const c = P.signCols
  const row = await db.one(
    `SELECT [${c.prep}] prep, [${c.l1}] l1, [${c.l1Time}] l1Time, [${c.l2}] l2, [${c.l2Time}] l2Time
       FROM ${P.headTable} WHERE 单据编号='${qs(no)}'`)
  return row || {}
}

export async function approvals(db, panel, no) {
  return db.q(
    `SELECT action, result, node_no, operator, opinion, create_time FROM yj_form_approval
      WHERE panel_code='${panel}' AND form_no='${qs(no)}' ORDER BY id`)
}

export async function headValue(db, panel, no, col) {
  const P = PANEL[panel]
  const row = await db.one(`SELECT [${col}] v FROM ${P.headTable} WHERE 单据编号='${qs(no)}'`)
  return row ? row.v : undefined
}

export async function detailCount(db, panel, no) {
  const P = PANEL[panel]
  return (await db.one(`SELECT COUNT(*) n FROM ${P.detailTable} WHERE 单据编号='${qs(no)}'`)).n
}

/* ───────────────────────── 建单 ───────────────────────── */
/** 本轮建过的单号(含"新增成功但保存失败"的半成品)—— 供脚本 finally 兜底清理 */
const TRACKED = []
export function trackedDocs() { return [...TRACKED] }

/**
 * 建草稿:先「新增」拿单号,再「保存」落表头/明细;任一步失败抛错(错误对象带 docNo 便于清理)。
 * @returns {Promise<{no:string, mk:any, save:any}>}
 */
export async function createDraft(cli, panel, { marker, headExtra = {}, items } = {}) {
  const P = PANEL[panel]
  const m = marker || runId()
  let no = ''
  let mk = null
  try {
    mk = await cli.callButton(panel, '新增', {})
    if (okCall(mk) && mk.data) no = S(mk.data['编号'] || mk.data['单据编号'] || mk.data['单号'])
    if (no) TRACKED.push({ panel, no, marker: m })
  } catch { mk = null }
  const payload = { ...P.createHead(m, headExtra) }
  if (no) payload['编号'] = no
  const useItems = items === undefined ? P.items : items
  if (useItems && useItems.length) payload.detail = { items: useItems }
  let sv = await cli.callButton(panel, '保存', payload)
  if (!okCall(sv) && !no) {
    // 兼容:个别面板「新增」不可用,直接「保存」也会建单
    sv = await cli.callButton(panel, '保存', { ...P.createHead(m, headExtra), detail: useItems?.length ? { items: useItems } : undefined })
  }
  if (sv.data) no = S(sv.data['编号'] || sv.data['单据编号'] || sv.data['单号']) || no
  if (!okCall(sv) || !no) {
    const err = new Error(`建单失败 panel=${panel} 编号=${no || '(空)'} save=${JSON.stringify(sv).slice(0, 400)} 新增=${JSON.stringify(mk).slice(0, 200)}`)
    err.docNo = no
    err.panel = panel
    throw err
  }
  if (!TRACKED.some((d) => d.panel === panel && d.no === no)) TRACKED.push({ panel, no, marker: m })
  return { no, mk, save: sv }
}

/**
 * 兜底清扫:删「本轮 track 的单」+ 两账套测试库里所有 AUTO_QCVER_ 标记残留(只碰 HSDZ_MES_TEST)。
 * 用于脚本 finally(异常中断也能清场);正常情况下前面已按白名单清过,这里重删 0 行无副作用。
 */
export async function sweepResidue(db, outDir, tag) {
  const docs = trackedDocs()
  for (const [panel, table] of [['QC_PROC_INSP', 'qc_proc_insp_head'], ['QC_FIRST_INSP', 'qc_first_insp_head'], ['QC_OQC_REPORT', 'qc_oqc_head']]) {
    try {
      const rows = await db.q(`SELECT 单据编号 FROM ${table} WHERE 客户名称 LIKE 'AUTO_QCVER[_]%'`)
      for (const row of rows) docs.push({ panel, no: S(row.单据编号), marker: 'sweep' })
    } catch { /* ignore */ }
  }
  const uniq = new Map(docs.filter((d) => d.no).map((d) => [d.panel + '|' + d.no, d]))
  if (!uniq.size) return { list: [], zero: true, residue: {}, autoResidue: {} }
  return cleanupDocs(db, [...uniq.values()], outDir, tag)
}

/* ───────────────────────── 测试夹具:测试库角色审批权 ───────────────────────── */
/**
 * 测试库旧快照没有 1031/1033/1039 等角色,QC_PROC_INSP/QC_FIRST_INSP 的 can_approve 全为 N
 * ⇒ 为验「组织架构审批权驱动审批流」,临时把**角色 4(研发审核;账号 cp=陈秀丽)** 对两面板
 * 置 can_approve='Y' 并补 audit 词;E2E 结束**原值还原**。只碰 HSDZ_MES_TEST。
 * (Lead 口径:测试夹具非产品改动,允许临时改并还原/清理,写清夹具 SQL 与还原证据。)
 */
export const FIXTURE = {
  roleId: 4, roleName: '研发审核', approverUser: 'cp', approverName: '陈秀丽',
  // 负测账号:测试库 role 2(普通用户)**无该面板审批权**;real_name=王光珍(与 cp 的「陈秀丽」区分开)
  negativeUser: 'wangguangzhen', negativeName: '王光珍',
  panels: ['QC_PROC_INSP', 'QC_FIRST_INSP'],
}

export async function fixtureGrant(db, outDir) {
  const inList = FIXTURE.panels.map((p) => `'${p}'`).join(',')
  const originals = await db.q(
    `SELECT panel_code, can_approve, ISNULL(perms,'') perms FROM yj_role_panel
      WHERE role_id=${FIXTURE.roleId} AND panel_code IN (${inList})`)
  const sql = [
    '-- 测试夹具(阶段2 E2E):临时给测试库角色 ' + FIXTURE.roleId + '(' + FIXTURE.roleName + ') 两面板审批权',
    '-- 原值已记录,测试结束由 fixture-restore 还原;只允许 HSDZ_MES_TEST。',
    `-- 原值: ${JSON.stringify(originals)}`,
    'DECLARE @db sysname = DB_NAME();',
    "IF @db <> 'HSDZ_MES_TEST' RAISERROR('fixture refused: %s', 16, 1, @db);",
    'ELSE BEGIN',
    `  UPDATE yj_role_panel SET can_approve='Y',`,
    `         perms = CASE WHEN ','+ISNULL(perms,'')+',' LIKE '%,audit,%' THEN perms ELSE ISNULL(perms,'')+',audit' END`,
    `   WHERE role_id=${FIXTURE.roleId} AND panel_code IN (${inList});`,
    'END',
  ].join('\n')
  if (outDir) fs.writeFileSync(path.join(outDir, 'fixture-grant.sql'), sql + '\n', 'utf8')
  const tx = new db.mssql.Transaction(db.pool)
  await tx.begin()
  try {
    await new db.mssql.Request(tx).query(sql)
    await tx.commit()
  } catch (e) { try { await tx.rollback() } catch { /* ignore */ } throw e }
  return { originals, sql }
}

export async function fixtureRestore(db, originals, outDir) {
  const sql = [
    '-- 测试夹具还原(把 E2E 临时授予的审批权改回原值)',
    'DECLARE @db sysname = DB_NAME();',
    "IF @db <> 'HSDZ_MES_TEST' RAISERROR('fixture restore refused: %s', 16, 1, @db);",
    'ELSE BEGIN',
    ...originals.map((o) =>
      `  UPDATE yj_role_panel SET can_approve='${qs(o.can_approve)}', perms=N'${qs(o.perms)}'` +
      ` WHERE role_id=${FIXTURE.roleId} AND panel_code='${qs(o.panel_code)}';`),
    'END',
  ].join('\n')
  if (outDir) fs.writeFileSync(path.join(outDir, 'fixture-restore.sql'), sql + '\n', 'utf8')
  const tx = new db.mssql.Transaction(db.pool)
  await tx.begin()
  try {
    await new db.mssql.Request(tx).query(sql)
    await tx.commit()
  } catch (e) { try { await tx.rollback() } catch { /* ignore */ } throw e }
  // 还原后复核
  const inList = originals.map((o) => `'${qs(o.panel_code)}'`).join(',')
  const now = await db.q(
    `SELECT panel_code, can_approve, ISNULL(perms,'') perms FROM yj_role_panel
      WHERE role_id=${FIXTURE.roleId} AND panel_code IN (${inList})`)
  let same = now.length === originals.length
  for (const o of originals) {
    const n = now.find((x) => x.panel_code === o.panel_code)
    if (!n || S(n.can_approve) !== S(o.can_approve) || S(n.perms) !== S(o.perms)) same = false
  }
  return { same, now, sql }
}

/* ───────────────────────── 清理(单号白名单 + DB 闸门) ───────────────────────── */
/**
 * 按**显式单号白名单**物理删除本次 E2E 建的单据(头/明细/yj_doc_status/yj_form_approval/yj_message)。
 * 只允许 HSDZ_MES_TEST;写盘 SQL 证据;清后逐单四表计数复核 0 残留。
 * @param docs [{panel, no, marker}]
 * @returns {Promise<{residue:any, autoResidue:any}>}
 */
export async function cleanupDocs(db, docs, outDir, tag = 'cleanup') {
  const uniq = new Map()
  for (const d of docs) {
    if (!d || !d.no || !PANEL[d.panel]) continue
    if (!/^[A-Za-z][A-Za-z0-9-]{4,60}$/.test(d.no)) throw new Error('清理拒绝:单号格式非法 ' + d.no)
    uniq.set(d.panel + '|' + d.no, d)
  }
  const list = [...uniq.values()]
  const byPanel = new Map()
  for (const d of list) {
    if (!byPanel.has(d.panel)) byPanel.set(d.panel, [])
    byPanel.get(d.panel).push(d.no)
  }
  const inList = list.map((d) => `'${qs(d.no)}'`).join(',') || 'NULL'
  const sql = []
  sql.push('-- 清理 2026-11-06 三项需求 E2E 测试数据(tag=' + tag + ')')
  sql.push('-- 硬闸门:仅允许测试账套 HSDZ_MES_TEST;删除范围 = 迁移脚本记录的显式单号白名单')
  sql.push(`-- 白名单(${list.length}): ${list.map((d) => d.panel + ':' + d.no).join(', ')}`)
  sql.push('DECLARE @db sysname = DB_NAME();')
  sql.push("IF @db <> 'HSDZ_MES_TEST' RAISERROR('cleanup refused: %s', 16, 1, @db);")
  sql.push('ELSE BEGIN')
  for (const [panel, nos] of byPanel) {
    const P = PANEL[panel]
    const inNos = nos.map((n) => `'${qs(n)}'`).join(',')
    sql.push(`  DELETE FROM ${P.detailTable} WHERE 单据编号 IN (${inNos});`)
    sql.push(`  DELETE FROM ${P.headTable} WHERE 单据编号 IN (${inNos});`)
  }
  sql.push(`  DELETE FROM yj_doc_status WHERE doc_no IN (${inList});`)
  sql.push(`  DELETE FROM yj_form_approval WHERE form_no IN (${inList});`)
  sql.push(`  DELETE FROM yj_message WHERE 单据编号 IN (${inList});`)
  sql.push('END')
  if (outDir) fs.writeFileSync(path.join(outDir, `${tag}.sql`), sql.join('\n') + '\n', 'utf8')
  const tx = new db.mssql.Transaction(db.pool)
  await tx.begin()
  try {
    await new db.mssql.Request(tx).query(sql.join('\n'))
    await tx.commit()
  } catch (e) { try { await tx.rollback() } catch { /* ignore */ } throw e }

  const residue = {}
  let zero = true
  for (const d of list) {
    const P = PANEL[d.panel]
    const c = await db.one(
      `SELECT (SELECT COUNT(*) FROM ${P.headTable} WHERE 单据编号='${qs(d.no)}') head,
              (SELECT COUNT(*) FROM ${P.detailTable} WHERE 单据编号='${qs(d.no)}') detail,
              (SELECT COUNT(*) FROM yj_doc_status WHERE doc_no='${qs(d.no)}') status,
              (SELECT COUNT(*) FROM yj_form_approval WHERE form_no='${qs(d.no)}') approval,
              (SELECT COUNT(*) FROM yj_message WHERE 单据编号='${qs(d.no)}') msg`)
    residue[d.panel + ':' + d.no] = c
    if (c.head || c.detail || c.status || c.approval || c.msg) zero = false
  }
  // AUTO_ 标记残留复核
  const markers = [...new Set(list.map((d) => d.marker).filter(Boolean))]
  const autoResidue = {}
  for (const panel of new Set(list.map((d) => d.panel))) {
    const P = PANEL[panel]
    const mk = markers.filter(Boolean)
    if (!mk.length) continue
    const like = mk.map((m) => `'AUTO_QCVER_${qs(m)}'`).join(',')
    autoResidue[panel] = (await db.one(
      `SELECT COUNT(*) n FROM ${P.headTable} WHERE 客户名称 IN (${like})`)).n
  }
  return { list: list.map((d) => d.panel + ':' + d.no), residue, autoResidue, zero }
}

/* ───────────────────────── 组织架构证据(正式库只读) ───────────────────────── */
/**
 * 用 8091 实例 + 自签 YJ(正式库)令牌 GET /api/auth/perms 取证:
 *  - 各账号的 approvePanels(登录响应同源,can_approve 推导)
 *  - GET /api/sys/role/{id}/panels 取角色授权矩阵(granted 内 can_approve)
 * 纯 GET,不写正式库。
 */
export async function prodOrgEvidence(base, users) {
  const out = { perms: {}, roles: {}, granted: {} }
  for (const u of users) {
    const cli = api(base, signToken(u, 'YJ'))
    try {
      const r = await cli.getJson('/api/auth/perms')
      if (r.code === 200 || r.code === 0) out.perms[u] = r.data
    } catch (e) { out.perms[u] = { error: String(e.message).slice(0, 200) } }
  }
  // 角色授权矩阵用 admin(正式库)读
  const adminCli = api(base, signToken('admin', 'YJ'))
  for (const rid of [1031, 1033, 1039, 1040, 1042]) {
    try {
      const r = await adminCli.getJson('/api/sys/role/' + rid + '/panels')
      const data = r.data || {}
      const grantedAll = data.granted || []
      out.granted[rid] = grantedAll.filter((g) => ['QC_PROC_INSP', 'QC_FIRST_INSP'].includes(g.panelCode || g.panel_code))
    } catch (e) { out.granted[rid] = { error: String(e.message).slice(0, 200) } }
  }
  try {
    const r = await adminCli.getJson('/api/sys/role/list')
    out.roles = (r.data || []).filter((x) => [1, 1031, 1033, 1039, 1040, 1042].includes(x.id ?? x.roleId))
  } catch (e) { out.roles = { error: String(e.message).slice(0, 200) } }
  return out
}
