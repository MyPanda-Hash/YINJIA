/**
 * _incident-recover.mjs —— 2026-11-08 事故恢复:误把 **正式库 HSDZ_MES** 的
 * QC_PROC_INSP/ZC-2026-10-0126 点了一次「弃审」(本应只在测试库点)。
 *
 * 背景(详见 README「事故与恢复」):
 *   · ego 浏览器与 Lead 共用同一 localhost:5173 origin 的 localStorage;Lead 在 00:07:59
 *     以 YJ(正式库)重新登录,覆盖了 mes_token;我 00:08:21 点的「弃审」因此落到正式库。
 *   · 正式库该单原状态 = 已审核(shr 非空),被弃审清成草稿,并多了一条 UNAUDIT 留痕。
 *   · 无其他写入:yj_message/form_flow_link 无新增。
 *
 * 恢复方式(**精确到单行**,不整库还原):
 *   ① 把 2026-11-06 21:22 的正式库备份换名拷进容器可见目录 `D:\sql\data`;
 *   ② sa 账号把该备份还原成**恢复库 HSDZ_MES_RECOVER_20261108**(只读用);
 *   ③ 比对恢复库 vs 正式库当前行,只回填本次弃审会改的列:
 *       yj_doc_status:shr/shsj/archived/effective/modify_state/approve_node/l2_approver/update_at
 *       qc_proc_insp_head:审核人/审核时间/审批人/审批时间/asp_user2/asp_time2
 *      并删除本轮新增的 yj_form_approval 行(UNAUDIT,id=14570);
 *   ④ 复核:docStatusOf 口径回到「已审核」、头行与恢复库一致、无新增留痕;
 *   ⑤ 删恢复库。
 *
 * 用法:
 *   node tools/archive/_wo-insp-audit-20261108/_incident-recover.mjs inspect
 *   node tools/archive/_wo-insp-audit-20261108/_incident-recover.mjs apply
 *   node tools/archive/_wo-insp-audit-20261108/_incident-recover.mjs drop
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { EVIDENCE, nowStamp } from './_lib.mjs'

const requireE2E = createRequire('D:/workspace/yinjia/tests/e2e/')
const mssql = requireE2E('mssql')
const SA = { server: '127.0.0.1', port: 1433, user: 'sa', password: process.env.YJ_SA_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }
const BAK_HOST = 'D:/workspace/HSDZ_MES_manual_20261106-212242.bak'
const BAK_CONTAINER = '/var/opt/mssql/data/_recover-20261106.bak'
const BAK_COPY_HOST = 'D:/sql/data/_recover-20261106.bak'
const RECOVER_DB = 'HSDZ_MES_RECOVER_20261108'
const FORMAL_DB = 'HSDZ_MES'
const PANEL = 'QC_PROC_INSP'
const DOC = 'ZC-2026-10-0126'
const OUT = path.join(EVIDENCE, 'incident')
fs.mkdirSync(OUT, { recursive: true })

const stage = process.argv[2] || 'inspect'
const conn = async (db, asSa = false) => {
  const pool = await new mssql.ConnectionPool({ ...(asSa ? SA : { ...SA }), database: db }).connect()
  const q = async (sql) => (await pool.request().query(sql)).recordset
  const exec = async (sql) => (await pool.request().query(sql))
  return { pool, q, exec, close: () => pool.close() }
}
const one = async (db, sql) => (await db.q(sql))[0] || null

/** docStatusOf 口径(是否「已审核」= shr 非空) */
const isAudited = (st) => !!st && st.shr !== null && st.shr !== undefined

const STATUS_COLS = ['shr', 'shsj', 'archived', 'effective', 'modify_state', 'approve_node', 'l2_approver', 'update_at']
const HEAD_COLS = ['审核人', '审核时间', '审批人', '审批时间', 'asp_user2', 'asp_time2']
const qs = (s) => String(s == null ? '' : s).replace(/'/g, "''")
const fmt = (v) => (v === null || v === undefined ? 'NULL' : (v instanceof Date ? v.toISOString() : String(v)))

async function readFormalState(db) {
  const st = await one(db, `SELECT * FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${DOC}'`)
  const head = await one(db, `SELECT * FROM qc_proc_insp_head WHERE 单据编号='${DOC}'`)
  const appr = await db.q(`SELECT id,action,result,node_no,operator,create_time FROM yj_form_approval WHERE panel_code='${PANEL}' AND form_no='${DOC}' ORDER BY id`)
  return { st, head, appr }
}
async function readRecoverState(db) {
  const st = await one(db, `SELECT * FROM yj_doc_status WHERE panel_code='${PANEL}' AND doc_no='${DOC}'`)
  const head = await one(db, `SELECT * FROM qc_proc_insp_head WHERE 单据编号='${DOC}'`)
  const appr = await db.q(`SELECT id,action,result,node_no,operator,create_time FROM yj_form_approval WHERE panel_code='${PANEL}' AND form_no='${DOC}' ORDER BY id`)
  return { st, head, appr }
}

if (stage === 'inspect' || stage === 'apply') {
  // ① 备份文件换名拷进容器可见目录(22 万 MB,一次即可)
  if (!fs.existsSync(BAK_COPY_HOST)) {
    if (!fs.existsSync(BAK_HOST)) throw new Error('备份不存在:' + BAK_HOST)
    fs.copyFileSync(BAK_HOST, BAK_COPY_HOST)
    console.log('[copy] ' + BAK_HOST + ' → ' + BAK_COPY_HOST + ' (' + fs.statSync(BAK_COPY_HOST).size + ' bytes)')
  } else console.log('[copy] 已存在 ' + BAK_COPY_HOST)

  const master = await conn('master', true)
  console.log('[sa] connected, sysadmin=' + (await one(master, "SELECT IS_SRVROLEMEMBER('sysadmin') v")).v)
  // ② 已存在恢复库就先删(仅恢复库,不碰正式库)
  const exists = await one(master, `SELECT database_id id FROM sys.databases WHERE name='${RECOVER_DB}'`)
  if (exists) {
    await master.exec(`ALTER DATABASE [${RECOVER_DB}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${RECOVER_DB}];`)
    console.log('[db] 已删除旧恢复库 ' + RECOVER_DB)
  }
  const files = await master.q(`RESTORE FILELISTONLY FROM DISK = N'${BAK_CONTAINER}'`)
  console.log('[bak] 文件:', JSON.stringify(files.map((f) => ({ LogicalName: f.LogicalName, Type: f.Type }))))
  const dataFile = files.find((f) => f.Type === 'D') || files[0]
  const logFile = files.find((f) => f.Type === 'L') || files[files.length - 1]
  const moveData = `/var/opt/mssql/data/${RECOVER_DB}.mdf`
  const moveLog = `/var/opt/mssql/data/${RECOVER_DB}_log.ldf`
  await master.exec(`RESTORE DATABASE [${RECOVER_DB}] FROM DISK = N'${BAK_CONTAINER}' WITH `
    + `MOVE N'${dataFile.LogicalName}' TO N'${moveData}', MOVE N'${logFile.LogicalName}' TO N'${moveLog}', RECOVERY, STATS = 25`)
  console.log('[restore] 恢复库已就绪: ' + RECOVER_DB)
  await master.close()

  // ③ 比对
  const rec = await conn(RECOVER_DB, true)
  const formal = await conn(FORMAL_DB, true)
  const R = await readRecoverState(rec)
  const F = await readFormalState(formal)
  console.log('\n== 恢复库(2026-11-06 备份) ==')
  console.log('status:', JSON.stringify(R.st))
  console.log('head:', JSON.stringify(Object.fromEntries(HEAD_COLS.map((c) => [c, fmt(R.head && R.head[c])]))))
  console.log('approval:', JSON.stringify(R.appr))
  console.log('\n== 正式库(当前) ==')
  console.log('status:', JSON.stringify(F.st))
  console.log('head:', JSON.stringify(Object.fromEntries(HEAD_COLS.map((c) => [c, fmt(F.head && F.head[c])]))))
  console.log('approval:', JSON.stringify(F.appr))
  const report = { at: new Date().toISOString(), recoverDb: RECOVER_DB, panel: PANEL, doc: DOC, recover: R, formal: F }
  fs.writeFileSync(path.join(OUT, 'incident-' + stage + '-' + nowStamp() + '.json'), JSON.stringify(report, null, 1) + '\n', 'utf8')

  if (stage === 'apply') {
    if (!R.st) throw new Error('恢复库里没有该单据状态行,拒绝继续')
    if (!isAudited(R.st)) throw new Error('恢复库该单不是「已审核」,与事故前提不符,拒绝继续')
    // ④ 只回填本次弃审会改的列(其余列不动)
    const sets = []
    for (const c of STATUS_COLS) {
      if (R.st[c] === undefined) continue
      sets.push(`[${c}] = ${R.st[c] === null ? 'NULL' : (R.st[c] instanceof Date ? `'${fmt(R.st[c])}'` : `'${qs(R.st[c])}'`)}`)
    }
    // update_at 用恢复库原值(datetime → ISO 字面量可被 SQL 隐式转)
    const sqlStatus = `UPDATE yj_doc_status SET ${sets.join(', ')} WHERE panel_code='${PANEL}' AND doc_no='${DOC}'`
    const sqlHead = `UPDATE qc_proc_insp_head SET ` + HEAD_COLS
      .map((c) => `[${c}] = ${R.head[c] === null ? 'NULL' : (R.head[c] instanceof Date ? `'${fmt(R.head[c])}'` : `'${qs(R.head[c])}'`)}`)
      .join(', ') + ` WHERE 单据编号='${DOC}'`
    const sqlDelAppr = `DELETE FROM yj_form_approval WHERE panel_code='${PANEL}' AND form_no='${DOC}'`
      + ` AND id NOT IN (${R.appr.map((a) => Number(a.id)).join(',') || '-1'})`
    console.log('\n[apply] ' + sqlStatus)
    console.log('[apply] ' + sqlHead)
    console.log('[apply] ' + sqlDelAppr)
    const tx = new mssql.Transaction(formal.pool)
    await tx.begin()
    try {
      const req = () => new mssql.Request(tx)
      await req().query(sqlStatus)
      await req().query(sqlHead)
      const d = await req().query(sqlDelAppr)
      await tx.commit()
      console.log('[apply] 完成,删除本轮新增留痕行 =', d.rowsAffected[0])
    } catch (e) { try { await tx.rollback() } catch { } throw e }
    // ⑤ 复核
    const F2 = await readFormalState(formal)
    const still = []
    for (const c of STATUS_COLS) if (String(fmt(F2.st && F2.st[c])) !== String(fmt(R.st[c]))) still.push('status.' + c)
    for (const c of HEAD_COLS) if (String(fmt(F2.head && F2.head[c])) !== String(fmt(R.head && R.head[c]))) still.push('head.' + c)
    const apprIds = F2.appr.map((a) => Number(a.id)).sort().join(',')
    const recIds = R.appr.map((a) => Number(a.id)).sort().join(',')
    console.log('\n== 复核 ==')
    console.log('已审核(shr 非空):', isAudited(F2.st), 'shr=' + fmt(F2.st && F2.st.shr))
    console.log('列差异(应为空):', JSON.stringify(still))
    console.log('审批留痕 id 恢复库=', recIds, ' 正式库=', apprIds)
    console.log('RESTORE_RESULT=' + (isAudited(F2.st) && still.length === 0 && apprIds === recIds ? 'PASS' : 'FAIL'))
  }
  await rec.close()
  await formal.close()
} else if (stage === 'drop') {
  const master = await conn('master', true)
  await master.exec(`ALTER DATABASE [${RECOVER_DB}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${RECOVER_DB}];`)
  console.log('[drop] 恢复库已删除 ' + RECOVER_DB)
  await master.close()
} else {
  console.error('用法: node _incident-recover.mjs inspect|apply|drop')
  process.exit(2)
}
console.log('INCIDENT_STAGE_DONE ' + stage)
