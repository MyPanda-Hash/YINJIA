/**
 * _seed-wo-insp.mjs —— 给已结案工单补「首件检验单 / 制程检验单」。2026-10-18
 *
 * 【用户口径】
 *   「质检数据怎么只有组装成品检验单的数据而没有另外两个检验单的」——
 *   引擎的工序→检验单映射(QcInspAutoService.OP_PANELS)是:
 *     成型 达标 ⇒ 首件检验单 QC_FIRST_INSP + 制程检验单 QC_PROC_INSP
 *     组装 达标 ⇒ 组装成品检验单 QC_ASM_INSP
 *   上一批只造了组装成品那张(它才是结案判据),首件/制程两张漏了 ⇒ 本脚本补齐。
 *
 * 【落点】
 *   · 首件检验单:SJ-yyyy-mm-#### → qc_first_insp_head + qc_first_insp_detail
 *     头带 工单号/工单行号/报工单号(成型)/工序=成型/批次号/生产线(成型线)/报工数量/生产日期;
 *     明细按「标准行(行号0) + 样品行(行号n)」两段铺(与库里既有首件单形态一致);
 *   · 制程检验单:ZC-yyyy-mm-#### → qc_proc_insp_head + qc_proc_insp_detail
 *     头带 检验类别=制程检验、工序=成型、抽检总量/检验数量、总结论=合格;
 *     明细 标准行 + 实测行;
 *   · 两张单都写 yj_doc_status(shr 非空)= 已审核,并登记 s_allno。
 *
 * 【取数】成型报工行(scjl.gxdm='成型')取 报工单号 / 报工日期 / 生产线 / 数量 —— 与检验单一一对应。
 * 【幂等】同一 (工单号, 工单行号) 已有存活的 首件/制程 单则跳过。
 * 【不碰】工单状态、组装成品检验、入库、领料。
 *
 * 用法(cd tools):
 *   node archive/_wo-flow-20261018/_seed-wo-insp.mjs --db HSDZ_MES [--apply|--verify|--cleanup --apply]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n)
  if (i < 0) return d
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const DB = String(arg('db', 'HSDZ_MES'))
const APPLY = process.argv.includes('--apply')
const CLEANUP = process.argv.includes('--cleanup')
const VERIFY = process.argv.includes('--verify')
const LIMIT = Number(arg('limit', 0)) || 0
const MARK = 'wo-insp-20261018'
const OUT = import.meta.dirname
const RB_FILE = path.join(OUT, `rollback-insp-${DB}.sql`)

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true, useUTC: false },
})
const q = async (s) => (await pool.request().query(s)).recordset
const pad = (n, w = 2) => String(n).padStart(w, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const qn = (s) => `N'${String(s == null ? '' : s).replace(/'/g, "''")}'`
const dt = (s) => `CONVERT(datetime,'${s}',120)`

/* ───────────────────────── 体检 ───────────────────────── */
if (VERIFY) {
  const s = (await q(`
    SELECT (SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(ja,'N') IN (N'T',N'Y') AND ISNULL(asp_cancel,'N')<>'Y') AS 已结案,
      (SELECT COUNT(*) FROM dbo.qc_first_insp_head WHERE asp_user1=N'${MARK}') AS 本批首件,
      (SELECT COUNT(*) FROM dbo.qc_first_insp_detail WHERE asp_user1=N'${MARK}') AS 本批首件明细,
      (SELECT COUNT(*) FROM dbo.qc_proc_insp_head WHERE asp_user1=N'${MARK}') AS 本批制程,
      (SELECT COUNT(*) FROM dbo.qc_proc_insp_detail WHERE asp_user1=N'${MARK}') AS 本批制程明细,
      (SELECT COUNT(*) FROM dbo.qc_asm_insp_head WHERE asp_user1=N'wo-flow-20261018') AS 组装成品`))[0]
  console.log(`== ${DB} 工序检验单体检 ==`)
  console.log(`  已结案 ${s.已结案} / 组装成品 ${s.组装成品} / 本批首件 ${s.本批首件}(明细 ${s.本批首件明细}) / 本批制程 ${s.本批制程}(明细 ${s.本批制程明细})`)
  const miss = (await q(`
    SELECT
      (SELECT COUNT(*) FROM dbo.plang p WHERE ISNULL(p.ja,'N') IN (N'T',N'Y') AND ISNULL(p.asp_cancel,'N')<>'Y'
         AND NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_head h WHERE h.[工单号]=p.pl_no
            AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0) AND ISNULL(h.asp_cancel,'N')<>'Y')) AS 缺首件,
      (SELECT COUNT(*) FROM dbo.plang p WHERE ISNULL(p.ja,'N') IN (N'T',N'Y') AND ISNULL(p.asp_cancel,'N')<>'Y'
         AND NOT EXISTS (SELECT 1 FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=p.pl_no
            AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0) AND ISNULL(h.asp_cancel,'N')<>'Y')) AS 缺制程,
      (SELECT COUNT(*) FROM dbo.plang p WHERE ISNULL(p.ja,'N') IN (N'T',N'Y') AND ISNULL(p.asp_cancel,'N')<>'Y'
         AND NOT EXISTS (SELECT 1 FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=p.pl_no
            AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0) AND ISNULL(h.asp_cancel,'N')<>'Y')) AS 缺组装`))[0]
  console.log(`  已结案行中缺单:首件 ${miss.缺首件} / 制程 ${miss.缺制程} / 组装 ${miss.缺组装}`)
  await pool.close()
  process.exit(0)
}

/* ───────────────────────── 回滚 ───────────────────────── */
if (CLEANUP) {
  if (!fs.existsSync(RB_FILE)) { console.log(`[中止] 找不到 ${RB_FILE}`); await pool.close(); process.exit(1) }
  const batches = fs.readFileSync(RB_FILE, 'utf8').split(/^\s*GO\s*$/m).map((x) => x.trim()).filter(Boolean)
  if (!APPLY) { console.log(`[预演] 将执行 ${path.basename(RB_FILE)}:${batches.length} 批`); await pool.close(); process.exit(0) }
  const tx = new mssql.Transaction(pool)
  await tx.begin()
  try {
    for (const b of batches) await new mssql.Request(tx).batch(b)
    await tx.commit()
    console.log(`[完成] 已回滚 ${DB}(${batches.length} 批)`)
  } catch (e) { await tx.rollback(); console.log('[失败并回滚] ' + e.message); process.exitCode = 1 }
  await pool.close()
  process.exit(0)
}

/* ───────────────────────── 目标:已结案 + 有成型报工(按 工单号+工单行号 去重) ───────────────────────── */
/* ⚠ 测试账里存在同 (工单号,工单行号) 多物理行(MO-2026-09-0006#1 ×4),直接 JOIN 会笛卡尔膨胀
   (每行各有一条成型报工 ⇒ 4×4)⇒ 必须按行标识聚合,一张标识只出一套检验单(与 QcInspAutoService 幂等键一致)。 */
const rows = await q(`
  SELECT MIN(p.id) AS id, p.pl_no, ISNULL(p.pl_xc,0) AS pl_xc,
         MAX(ISNULL(p.dm,N'')) AS dm, MAX(ISNULL(p.mc,N'')) AS mc, MAX(ISNULL(p.gg,N'')) AS gg,
         MAX(ISNULL(p.[批次号],N'')) AS lot, MAX(ISNULL(p.pl_sl,0)) AS pl_sl,
         MIN(s.[报工单号]) AS 成型报工单,
         MIN(CONVERT(varchar(10), s.sc_date, 120)) AS 成型日期,
         MIN(ISNULL(s.scx,N'')) AS 成型线, MAX(ISNULL(s.sl,0)) AS 成型数量,
         (SELECT COUNT(*) FROM dbo.qc_first_insp_head h WHERE h.[工单号]=p.pl_no
            AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0) AND ISNULL(h.asp_cancel,'N')<>'Y') AS 有首件,
         (SELECT COUNT(*) FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=p.pl_no
            AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0) AND ISNULL(h.asp_cancel,'N')<>'Y') AS 有制程
  FROM dbo.plang p
  JOIN dbo.scjl s ON s.gldh = p.pl_no AND ISNULL(s.[工单行号],0) = ISNULL(p.pl_xc,0)
    AND s.gxdm = N'成型' AND ISNULL(s.asp_cancel,'N') <> 'Y'
  WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') IN (N'T',N'Y')
    AND (NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_head h WHERE h.[工单号]=p.pl_no
          AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0) AND ISNULL(h.asp_cancel,'N')<>'Y')
      OR NOT EXISTS (SELECT 1 FROM dbo.qc_proc_insp_head h WHERE h.[工单号]=p.pl_no
          AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0) AND ISNULL(h.asp_cancel,'N')<>'Y'))
  GROUP BY p.pl_no, ISNULL(p.pl_xc,0)
  ORDER BY p.pl_no, ISNULL(p.pl_xc,0)`)
let target = rows
if (LIMIT > 0) target = rows.slice(0, LIMIT)

const lineWs = {}
for (const l of await q(`SELECT 生产线, ISNULL(生产车间,N'') AS 车间 FROM dbo.bs_prod_line WHERE ISNULL(asp_cancel,'N')<>'Y'`)) {
  lineWs[l.生产线] = l.车间
}

/* ───────────────────────── 号池 SJ / ZC ───────────────────────── */
const seqState = new Map()
async function nextNo(lb, d) {
  const key = `${lb}|${ym(d)}`
  if (!seqState.has(key)) {
    const tbl = lb === 'SJ' ? 'qc_first_insp_head' : 'qc_proc_insp_head'
    const mx = (await q(`SELECT MAX([单据编号]) AS mx FROM dbo.${tbl} WHERE [单据编号] LIKE N'${lb}-${ym(d)}-%'`))[0]
    const mx2 = (await q(`SELECT MAX(dh) AS mx FROM dbo.s_allno WHERE lb=N'${lb}' AND ny=N'${ym(d)}'`))[0]
    const parse = (s) => { if (!s) return 0; const m = String(s).match(/(\d+)$/); return m ? Number(m[1]) : 0 }
    seqState.set(key, Math.max(parse(mx.mx), parse(mx2.mx)))
  }
  const n = seqState.get(key) + 1
  seqState.set(key, n)
  return `${lb}-${ym(d)}-${pad(n, 4)}`
}

const WORKERS = ['柴善银', '刘磊', '冯敏', '陈秀丽']
const plan = []
for (const r of target) {
  const d = r.成型日期 ? new Date(`${r.成型日期}T08:30:00`) : new Date()
  const line = r.成型线 || ''
  plan.push({
    r, d, line, ws: lineWs[line] || '成型',
    worker: WORKERS[(Number(String(r.id).slice(-3)) || 0) % WORKERS.length],
    sjNo: r.有首件 > 0 ? null : await nextNo('SJ', d),
    zcNo: r.有制程 > 0 ? null : await nextNo('ZC', d),
  })
}

console.log(`== ${DB} 首件/制程检验单补数(标记 ${MARK})==`)
console.log(`  已结案且缺这两张单的工单行 ${plan.length} 行`)
for (const p of plan.slice(0, 2)) {
  console.log(`  例 ${p.r.pl_no}#${p.r.pl_xc} 成型报工 ${p.r.成型报工单} ${p.r.成型日期} @${p.line} → 首件 ${p.sjNo} / 制程 ${p.zcNo}`)
}
if (!APPLY) { console.log('\n[预演结束] 加 --apply 才落库'); await pool.close(); process.exit(0) }

/* ───────────────────────── 回滚脚本 ───────────────────────── */
const rb = []
rb.push(`/* rollback-insp-${DB}.sql —— 回滚 ${MARK} 首件/制程检验单补数 */`)
rb.push(`SET NOCOUNT ON;`)
rb.push(`DELETE FROM dbo.yj_doc_status WHERE panel_code IN (N'QC_FIRST_INSP',N'QC_PROC_INSP') AND doc_no IN`
  + ` (SELECT [单据编号] FROM dbo.qc_first_insp_head WHERE asp_user1=N'${MARK}'`
  + `  UNION ALL SELECT [单据编号] FROM dbo.qc_proc_insp_head WHERE asp_user1=N'${MARK}');`)
rb.push(`DELETE FROM dbo.qc_first_insp_detail WHERE asp_user1=N'${MARK}';`)
rb.push(`DELETE FROM dbo.qc_first_insp_head WHERE asp_user1=N'${MARK}';`)
rb.push(`DELETE FROM dbo.qc_proc_insp_detail WHERE asp_user1=N'${MARK}';`)
rb.push(`DELETE FROM dbo.qc_proc_insp_head WHERE asp_user1=N'${MARK}';`)
rb.push(`DELETE FROM dbo.s_allno WHERE asp_user1=N'${MARK}';`)
rb.push(`GO`)
/* 回滚脚本只在首次生成:按标记删除覆盖**本批全部**行(含后续增量补的),不必重写 */
if (!fs.existsSync(RB_FILE)) fs.writeFileSync(RB_FILE, rb.join('\n') + '\n', 'utf8')
console.log(`\n  回滚脚本: ${RB_FILE}`)

/* 明细模板(与库里既有首件单同形:标准行 行号0 + 样品行 行号n) */
const ITEMS = [
  { 项目: '炭棒外径', 要求: '按规格型号,公差 ±0.5mm', 方法: '游标卡尺测量', 值: '符合' },
  { 项目: '炭棒长度', 要求: '按规格型号,公差 ±0.5mm', 方法: '游标卡尺测量', 值: '符合' },
  { 项目: '炭棒重量', 要求: '按产品标准', 方法: '电子秤称量', 值: '符合' },
  { 项目: '外观', 要求: '无破损、无压痕、无裂纹、无脏污', 方法: '目视全检', 值: '合格' },
  { 项目: '跌落强度', 要求: '50cm 自由跌落 3 次无断裂', 方法: '跌落试验', 值: '合格' },
]
const PROC_ITEMS = [
  { 项目: '成型压力', 要求: '按成型工艺参数', 方法: '设备仪表读取', 值: '符合' },
  { 项目: '成型温度', 要求: '按成型工艺参数', 方法: '设备仪表读取', 值: '符合' },
  { 项目: '外观抽检', 要求: '无破损、无裂纹', 方法: '目视抽检', 值: '合格' },
]

/* ───────────────────────── 执行 ───────────────────────── */
/* 幂等:逐行判「首件缺 / 制程缺」,缺哪张补哪张 ⇒ 可直接增量重跑(不像前两批要 --cleanup) */
if (!plan.length) { console.log('\n[无需处理] 已结案行的首件/制程都齐了'); await pool.close(); process.exit(0) }

const tx = new mssql.Transaction(pool)
await tx.begin()
const req = () => new mssql.Request(tx)
let done = 0
try {
  for (const p of plan) {
    const r = p.r
    const dateStr = ymd(p.d)
    const at = `${dateStr} 08:30:00`
    const qty = Number(r.成型数量) || Number(r.pl_sl) || 0

    /* ① 首件检验单(缺才补) */
    if (p.sjNo) {
    await req().query(`
      INSERT INTO dbo.qc_first_insp_head (单据编号, 单据日期, 工单号, 工单行号, 报工单号, 工序, 批次号,
        产品编码, 产品名称, 规格型号, 生产线, 生产车间, 报工数量, 检验数量, 检验员, 检验日期, 总结论,
        生产日期, 处理方式, asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
      VALUES (${qn(p.sjNo)}, CONVERT(date,'${dateStr}'), ${qn(r.pl_no)}, ${r.pl_xc}, ${qn(r.成型报工单)}, N'成型',
        ${qn(r.lot)}, ${qn(r.dm)}, ${qn(r.mc)}, ${qn(r.gg)}, ${qn(p.line)}, ${qn(p.ws)}, ${qty}, ${qty},
        ${qn(p.worker)}, CONVERT(date,'${dateStr}'), N'合格', ${qn(dateStr)}, N'合格转序',
        N'${MARK}', SYSDATETIME(), N'admin', ${dt(at)}, N'N')`)
    for (let k = 0; k < ITEMS.length; k++) {
      const it = ITEMS[k]
      await req().query(`
        INSERT INTO dbo.qc_first_insp_detail (单据编号, 表区, 行号, 检验项目, 检验要求, 检验方法, 检查频率,
          行类型, asp_user1, asp_time1, asp_cancel)
        VALUES (${qn(p.sjNo)}, N'首件检验', 0, ${qn(it.项目)}, ${qn(it.要求)}, ${qn(it.方法)}, N'首件/每批',
          N'标准', N'${MARK}', SYSDATETIME(), N'N')`)
      await req().query(`
        INSERT INTO dbo.qc_first_insp_detail (单据编号, 表区, 行号, 检验项目, 检验要求, 检验方法, 实测数值,
          结果判断, 数量, 不合格数量, 行类型, asp_user1, asp_time1, asp_cancel)
        VALUES (${qn(p.sjNo)}, N'首件检验', ${k + 1}, ${qn(it.项目)}, ${qn(it.要求)}, ${qn(it.方法)}, ${qn(it.值)},
          N'合格', 1, 0, N'样品', N'${MARK}', SYSDATETIME(), N'N')`)
    }
    await req().query(`INSERT INTO dbo.yj_doc_status (panel_code, doc_no, shr, shsj, canceled, pending, update_at, saved, archived, deleting)
      VALUES (N'QC_FIRST_INSP', ${qn(p.sjNo)}, ${qn(p.worker)}, ${dt(at)}, N'N', N'N', SYSDATETIME(), N'Y', N'N', N'N')`)
    await req().query(`INSERT INTO dbo.s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
      VALUES (N'0', ${qn(p.sjNo)}, N'SJ', N'${ym(p.d)}', N'${MARK}', SYSDATETIME(), N'N')`)
    }

    /* ② 制程检验单(缺才补) */
    if (p.zcNo) {
    await req().query(`
      INSERT INTO dbo.qc_proc_insp_head (单据编号, 单据日期, 检验类别, 工单号, 工单行号, 报工单号, 工序,
        批次号, 产品编码, 产品名称, 规格型号, 生产线, 生产车间, 报工数量, 抽检总量, 检验数量, 检验员,
        检验日期, 总结论, 处理方式, asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
      VALUES (${qn(p.zcNo)}, CONVERT(date,'${dateStr}'), N'制程检验', ${qn(r.pl_no)}, ${r.pl_xc},
        ${qn(r.成型报工单)}, N'成型', ${qn(r.lot)}, ${qn(r.dm)}, ${qn(r.mc)}, ${qn(r.gg)}, ${qn(p.line)},
        ${qn(p.ws)}, ${qty}, ${qty}, ${qty}, ${qn(p.worker)}, CONVERT(date,'${dateStr}'), N'合格', N'合格转序',
        N'${MARK}', SYSDATETIME(), N'admin', ${dt(at)}, N'N')`)
    for (let k = 0; k < PROC_ITEMS.length; k++) {
      const it = PROC_ITEMS[k]
      await req().query(`
        INSERT INTO dbo.qc_proc_insp_detail (单据编号, 表区, 行号, 检验项目, 检验要求, 检验方法, 抽检量,
          实测数值, 结果判断, 单项判定, 检查频率, asp_user1, asp_time1, asp_cancel)
        VALUES (${qn(p.zcNo)}, N'制程检验', 0, ${qn(it.项目)}, ${qn(it.要求)}, ${qn(it.方法)}, 0,
          NULL, NULL, NULL, N'每2小时', N'${MARK}', SYSDATETIME(), N'N')`)
      await req().query(`
        INSERT INTO dbo.qc_proc_insp_detail (单据编号, 表区, 行号, 检验项目, 检验要求, 检验方法, 抽检量,
          实测数值, 结果判断, 单项判定, 不良数量, asp_user1, asp_time1, asp_cancel)
        VALUES (${qn(p.zcNo)}, N'制程检验', ${k + 1}, ${qn(it.项目)}, ${qn(it.要求)}, ${qn(it.方法)}, 1,
          ${qn(it.值)}, N'合格', N'合格', 0, N'${MARK}', SYSDATETIME(), N'N')`)
    }
    await req().query(`INSERT INTO dbo.yj_doc_status (panel_code, doc_no, shr, shsj, canceled, pending, update_at, saved, archived, deleting)
      VALUES (N'QC_PROC_INSP', ${qn(p.zcNo)}, ${qn(p.worker)}, ${dt(at)}, N'N', N'N', SYSDATETIME(), N'Y', N'N', N'N')`)
    await req().query(`INSERT INTO dbo.s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
      VALUES (N'0', ${qn(p.zcNo)}, N'ZC', N'${ym(p.d)}', N'${MARK}', SYSDATETIME(), N'N')`)
    }

    if (++done % 100 === 0) console.log(`  ...已补 ${done}/${plan.length}`)
  }
  await tx.commit()
  console.log(`\n[完成] ${DB}:${done} 行补齐首件+制程检验单`)
} catch (e) {
  await tx.rollback()
  console.log('\n[失败并回滚] ' + e.message)
  process.exitCode = 1
}
await pool.close()
