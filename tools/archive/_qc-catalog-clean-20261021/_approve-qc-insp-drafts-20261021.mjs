/**
 * 来料检验单「3 张草稿」补合格数量 + 走完审批 + 审核人落「冯敏」（2026-10-21）
 *
 * 用户口径：
 *   ① 处理当前来料检验单的草稿单据；
 *   ② 审核人都需要是冯敏；
 *   ③ 合格数量先按送检数量补齐再审核。
 *
 * 口径落地：
 *   · 只处理这 3 张：IJ-2026-09-0152 / IJ-2026-10-0001 / IJ-2026-10-0200；
 *   · 合格数量为空/0 的明细 → = 送检数量（已有值不动）；
 *   · 提交审批用 admin（编制/提交人），一级「审批通过」用 fm（质量审核角色 1039，real_name=冯敏），
 *     QC_INSP 是单节点审批，一级通过即已审核；
 *   · 通过后把纸面 审核人 / yj_doc_status.shr 统一成 **冯敏**，时间用中国本地时间
 *     （SQL Server 跑在 UTC 容器里，GETDATE() 会差 8 小时，故显式 AT TIME ZONE）。
 *
 * ⚠ 审核会触发 `inspAutoPurchaseIn`：合格数量>0 的明细自动生成采购入库单草稿
 *   （实测：0152→PI-2026-10-0024、0001→PI-2026-10-0025、0200→PI-2026-10-0026）。
 *
 * 用法（在仓库根目录）：
 *   $env:YINJIA_UI_ADMIN_PASS='...'; $env:YINJIA_UI_FM_PASS='...'
 *   node tools/archive/_qc-catalog-clean-20261021/_approve-qc-insp-drafts-20261021.mjs --db HSDZ_MES
 *
 * 幂等：已审核且审核人=冯敏的单跳过；已审核但 shr 不是 fm/冯敏的单只告警不覆盖。
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES')
const BASE = arg('base', 'http://127.0.0.1:8090')
const ADMIN_PASS = process.env.YINJIA_UI_ADMIN_PASS || arg('admin-pass', '')
const FM_PASS = process.env.YINJIA_UI_FM_PASS || arg('fm-pass', '')
if (!ADMIN_PASS || !FM_PASS) {
  console.error('缺少密码：请设 YINJIA_UI_ADMIN_PASS / YINJIA_UI_FM_PASS（或 --admin-pass/--fm-pass）')
  process.exit(2)
}

const DOCS = ['IJ-2026-09-0152', 'IJ-2026-10-0001', 'IJ-2026-10-0200']
const AUDITOR = '冯敏'
const FM_ACCOUNT = 'fm'   // 质量审核角色 1039，real_name=冯敏

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})

/** 中国本地时间（DB 容器是 UTC，纸面签名时间不能用 GETDATE） */
const CN_NOW = `CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'China Standard Time' AS datetime2)`

async function statusOf(no) {
  const r = await pool.request().input('no', no).query(`
    SELECT h.单据编号, h.审核人 head_auditor,
           s.shr, s.pending, s.saved, s.archived, s.canceled
    FROM qc_insp h
    LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
    WHERE h.单据编号=@no AND ISNULL(h.asp_cancel,'N')<>'Y'`)
  return r.recordset[0]
}

async function login(user, pass) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: user, password: pass }),
  })
  const j = await res.json()
  if (j.code !== 200 || !j.data?.token) throw new Error(`登录失败 ${user}: ${j.message || JSON.stringify(j).slice(0, 120)}`)
  return j.data.token
}

async function call(token, buttonName, no, opinion) {
  const formData = { 编号: no }
  if (opinion) formData.审批意见 = opinion
  const res = await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode: 'QC_INSP', buttonName, formData, buttonParam: {} }),
  })
  const j = await res.json()
  if (j.code !== 200) throw new Error(`${buttonName} ${no} 失败: ${j.message || JSON.stringify(j).slice(0, 200)}`)
  return j.data
}

let adminToken = null
let fmToken = null
let changed = 0

for (const no of DOCS) {
  const st = await statusOf(no)
  if (!st) { console.log(`[跳过] ${no} 不存在/已作废`); continue }
  if (st.shr === AUDITOR && st.head_auditor === AUDITOR) {
    console.log(`[跳过] ${no} 已是审核人=${AUDITOR}`)
    continue
  }
  if (st.shr && st.shr !== FM_ACCOUNT && st.shr !== AUDITOR) {
    console.log(`[告警] ${no} 已被 ${st.shr} 审核，不覆盖`); continue
  }

  // ① 合格数量为空/0 → = 送检数量（只补空，不改已有值）
  const q = await pool.request().input('no', no).query(`
    UPDATE dt SET dt.合格数量 = dt.送检数量, dt.asp_user2=N'qc-approve-20261021', dt.asp_time2=GETDATE()
    FROM qc_insp_detail dt
    WHERE dt.单据编号=@no AND ISNULL(dt.asp_cancel,'N')<>'Y'
      AND (dt.合格数量 IS NULL OR dt.合格数量=0) AND dt.送检数量 IS NOT NULL;
    SELECT @@ROWCOUNT n`)
  if (q.recordset[0].n > 0) console.log(`[补数] ${no} 合格数量补齐 ${q.recordset[0].n} 行`)

  // ② 草稿 → 提交审批(admin) → 一级审批通过(fm)
  const isDraft = !st.shr && !['Y'].includes(String(st.pending)) && !['Y'].includes(String(st.archived))
  if (isDraft) {
    adminToken ??= await login('admin', ADMIN_PASS)
    fmToken ??= await login(FM_ACCOUNT, FM_PASS)
    await call(adminToken, '提交审批', no, null)
    const r = await call(fmToken, '审批通过', no, '冯敏审核')
    console.log(`[审批] ${no} → ${r.单据状态}`)
  }

  // ③ 审核人统一落 冯敏（账号 fm 的姓名），时间用中国本地时间
  await pool.request().input('no', no).input('who', AUDITOR).query(`
    UPDATE s SET shr=@who, shsj=${CN_NOW}, approve_node=NULL, pending_by=NULL, pending_at=NULL,
                 saved=N'Y', archived=N'N', update_at=GETDATE()
    FROM yj_doc_status s WHERE s.panel_code='QC_INSP' AND s.doc_no=@no;
    UPDATE h SET 审核人=@who, 审核时间=CONVERT(varchar(19), ${CN_NOW}, 120),
                 asp_user2=N'qc-approve-20261021', asp_time2=GETDATE()
    FROM qc_insp h WHERE h.单据编号=@no;`)
  console.log(`[落章] ${no} 审核人=${AUDITOR}`)
  changed++
}

console.log(`=== 完成：处理 ${changed} 张（数据库 ${DB}）===`)
await pool.close()
