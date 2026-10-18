/**
 * _seed-wo-flow.mjs —— 生产工单「全流程推进」(2026-10-18)
 *
 * 【用户口径】
 *   「对当前的生产工单数据进行流转…只补处理近三日数据,其余都推进。」
 *   追认后的最终口径:近 3 个自然日(今天往前推 3 天)**一律不动**;其余工单
 *   全部推进到**结案**——排产 → 三道报工 → 组装成品检验已审核 → 产成品入库已审核 → ja='Y'。
 *
 * 【为什么是这套落点】(逐条对齐系统自己的口径,不是乱填)
 *   · 工艺路线:所有工单行都是 GY-CB-STD(成型 → 切炭 → 组装,换算率见 bs_route);
 *   · 排产:plang.scx(当前在末道组装线)+ plang_pc 镜像行(报工 gd_id 的锚点,唯一身份 = 工单行);
 *   · 报工:一道工序一张报工单(BG-ym-####),scjl.wgzt='Y' + yj_doc_status.shr 非空;
 *     工序名落 scjl.gxdm(引擎按工序名称比对 bs_route.工序名称);
 *   · 组装成品检验:qc_asm_insp_head 带 工单号 + 工单行号 + 批次号 + 合格数量;
 *     结案判据(ProcessTaskService.syncCloseState / PlangClose)要求它**已审核**;
 *   · 产成品入库:bd_finish_in + bl_finish_in,加工单号 = 工单号、工单行号 = 工单行号、
 *     实收合计 = 排产数量(入库 ≥ 排产才允许结案),单据状态 = 已审核;
 *   · 结案:plang.ja='Y' 且 rk_sl ≥ pl_sl ⇒ 结案体检(WorkOrderCloseGuard)不会把它判成异常结案;
 *   · 工序任务 wo_progress 同步补 3 道(完成数量 = 计划数量,状态='已完工'),
 *     让排产看板的「已报工」与 scjl 事实一致。
 *
 * 【不碰的东西】
 *   · 库存流水(inh/outh/kucun)与月结:本脚本只推动工单链,不记账;
 *   · 材料出库/领料:结案不要求领料,保持原样;
 *   · 已有下游单据的工单行(报工/检验/入库任一存在)一律跳过,避免覆盖现场正在做的单。
 *
 * 【安全】
 *   · 所有新建行打标记 asp_user1='wo-flow-20261018',可一键回滚;
 *   · 执行前生成 rollback-<DB>.sql(逐行复位 plang 原值 + 按标记删单),--cleanup 直接跑它;
 *   · plang 只改被选中的行,原值逐列快照进回滚脚本。
 *
 * 用法(cd tools):
 *   node archive/_wo-flow-20261018/_seed-wo-flow.mjs --db HSDZ_MES                 # 预演
 *   node archive/_wo-flow-20261018/_seed-wo-flow.mjs --db HSDZ_MES --apply         # 执行
 *   node archive/_wo-flow-20261018/_seed-wo-flow.mjs --db HSDZ_MES --verify        # 只读体检
 *   node archive/_wo-flow-20261018/_seed-wo-flow.mjs --db HSDZ_MES --cleanup --apply  # 回滚
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
const MARK = 'wo-flow-20261018'
const OUT = import.meta.dirname
const RB_FILE = path.join(OUT, `rollback-${DB}.sql`)

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  // useUTC=false:库里的 datetime 是**本地墙钟**,读写都按本地解释,
  // 否则 22:00 的 pl_date 读回来会被 +8h 漂到次日(报工日期/批次号跟着错一天)。
  options: { encrypt: false, trustServerCertificate: true, useUTC: false },
})
const q = async (s) => (await pool.request().query(s)).recordset

const pad = (n, w = 2) => String(n).padStart(w, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const at = (d, hhmm) => `${ymd(d)}T${hhmm}:00`
const qn = (s) => `N'${String(s == null ? '' : s).replace(/'/g, "''")}'`
const num = (v) => (v == null ? 0 : Number(v))

/* ───────────────────────── 只读体检 ───────────────────────── */
if (VERIFY) {
  const stat = (await q(`
    SELECT COUNT(*) AS 工单行,
      SUM(CASE WHEN ISNULL(p.scx,N'')<>N'' THEN 1 ELSE 0 END) AS 已排产,
      SUM(CASE WHEN ISNULL(p.[完工状态],N'')=N'生产完工' THEN 1 ELSE 0 END) AS 已完工,
      SUM(CASE WHEN ${'ISNULL(p.ja,\'N\') IN (N\'T\',N\'Y\')'} THEN 1 ELSE 0 END) AS 已结案,
      SUM(CASE WHEN ISNULL(p.asp_user1,N'')=N'${MARK}' THEN 1 ELSE 0 END) AS 本批推进
    FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'`))[0]
  console.log(`== ${DB} 工单行体检 ==`)
  console.log(`  工单行 ${stat.工单行} / 已排产 ${stat.已排产} / 已完工 ${stat.已完工} / 已结案 ${stat.已结案} / 本批推进 ${stat.本批推进}`)
  const fake = await q(`
    SELECT COUNT(*) AS 异常结案 FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') IN (N'T',N'Y')
      AND NOT (ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)
        AND EXISTS (SELECT 1 FROM dbo.qc_asm_insp_head h
          JOIN dbo.yj_doc_status ds ON ds.panel_code=N'QC_ASM_INSP' AND ds.doc_no=h.[单据编号]
          WHERE h.[工单号]=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y'
            AND ds.shr IS NOT NULL AND ISNULL(ds.canceled,'N')<>'Y' AND ISNULL(ds.stopped,'N')<>'Y'
            AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0)))`)
  console.log(`  结案体检异常 ${fake[0].异常结案}(应为 0)`)
  const docs = await q(`
    SELECT N'scjl 报工' AS 表, COUNT(*) AS 行数 FROM dbo.scjl WHERE asp_user1=N'${MARK}'
    UNION ALL SELECT N'qc_asm_insp_head', COUNT(*) FROM dbo.qc_asm_insp_head WHERE asp_user1=N'${MARK}'
    UNION ALL SELECT N'bd_finish_in', COUNT(*) FROM dbo.bd_finish_in WHERE asp_user1=N'${MARK}'
    UNION ALL SELECT N'plang_pc', COUNT(*) FROM dbo.plang_pc WHERE asp_user1=N'${MARK}'
    UNION ALL SELECT N'wo_progress', COUNT(*) FROM dbo.wo_progress WHERE asp_user1=N'${MARK}'`)
  console.log('  本批单据:' + docs.map((d) => `${d.表}=${d.行数}`).join(' / '))
  await pool.close()
  process.exit(0)
}

/* ───────────────────────── 回滚 ───────────────────────── */
if (CLEANUP) {
  if (!fs.existsSync(RB_FILE)) { console.log(`[中止] 找不到回滚脚本 ${RB_FILE}`); await pool.close(); process.exit(1) }
  const sql = fs.readFileSync(RB_FILE, 'utf8')
  const batches = sql.split(/^\s*GO\s*$/m).map((s) => s.trim()).filter(Boolean)
  if (!APPLY) {
    console.log(`[预演] 将执行回滚脚本 ${path.basename(RB_FILE)}:${batches.length} 批`)
    await pool.close(); process.exit(0)
  }
  const tx = new mssql.Transaction(pool)
  await tx.begin()
  try {
    for (const b of batches) await new mssql.Request(tx).batch(b)
    await tx.commit()
    console.log(`[完成] 已回滚 ${DB}(${batches.length} 批)`)
  } catch (e) {
    await tx.rollback()
    console.log('[失败并回滚] ' + e.message)
    process.exitCode = 1
  }
  await pool.close()
  process.exit(0)
}

/* ───────────────────────── 取口径数据 ───────────────────────── */
const cutoff = (await q(`SELECT CONVERT(varchar(10), DATEADD(day,-3,CONVERT(date,GETDATE())), 120) AS d`))[0].d
const lines = await q(`SELECT 生产线, ISNULL(生产车间,N'') AS 车间 FROM dbo.bs_prod_line
  WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(停用,0)=0 AND ISNULL(生产车间,N'')<>N''
  ORDER BY 生产车间, 生产线`)
const route = await q(`SELECT 工序名称, ISNULL(生产车间,N'') AS 车间, ISNULL(加工顺序,999) AS 序
  FROM dbo.bs_route WHERE 工艺路线编码='GY-CB-STD' AND ISNULL(asp_cancel,'N')<>'Y'
    AND ISNULL(工序名称,N'')<>N'' ORDER BY 加工顺序`)
const linesOf = (ws) => lines.filter((l) => l.车间 === ws).map((l) => l.生产线)
if (!route.length) { console.log('[中止] bs_route 里没有 GY-CB-STD 路线'); await pool.close(); process.exit(1) }
for (const r of route) {
  if (!linesOf(r.车间).length) { console.log(`[中止] 车间「${r.车间}」没有可用产线`); await pool.close(); process.exit(1) }
}

/* 目标行:近 3 日之外、未作废、有产品与排产量;已有下游单据的跳过 */
const rows = await q(`
  SELECT p.id, p.pl_no, ISNULL(p.pl_xc,0) AS pl_xc, ISNULL(p.dm,N'') AS dm, ISNULL(p.mc,N'') AS mc,
         ISNULL(p.gg,N'') AS gg, ISNULL(p.jldw,N'支') AS jldw, ISNULL(p.khdm,N'') AS khdm,
         ISNULL(p.od_no,N'') AS od_no, ISNULL(p.od_xc,0) AS od_xc, ISNULL(p.[批次号],N'') AS lot,
         ISNULL(p.pl_sl,0) AS pl_sl, ISNULL(p.pl_sl2,0) AS pl_sl2, ISNULL(p.xq_sl,0) AS xq_sl,
         ISNULL(p.cp_date,NULL) AS cp_date, ISNULL(p.st_date,NULL) AS st_date,
         ISNULL(CONVERT(varchar(10), p.pl_date, 120), N'') AS pl_date_s, p.pl_date, ISNULL(p.asp_user1,N'') AS asp_user1, ISNULL(p.ja,'N') AS ja,
         ISNULL(p.scx,N'') AS scx, ISNULL(p.rk_sl,0) AS rk_sl, ISNULL(p.rk_no,N'') AS rk_no,
         ISNULL(p.[完工状态],N'') AS 完工状态, ISNULL(p.[当前工序],N'') AS 当前工序,
         ISNULL(p.[当前工序完工量],0) AS 当前工序完工量, p.[完工时间] AS 完工时间, p.cp_date2 AS cp_date2,
         ISNULL(p.asp_user2,N'') AS asp_user2
  FROM dbo.plang p
  WHERE ISNULL(p.asp_cancel,'N')<>'Y'
    AND ISNULL(p.pl_date, CONVERT(datetime,'19000101',112)) < CONVERT(date, '${cutoff}')
    AND ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.dm,N'') <> N''
    AND ISNULL(p.ja,'N') NOT IN (N'T',N'Y')
    AND NOT EXISTS (SELECT 1 FROM dbo.scjl s WHERE s.gldh = p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y')
    AND NOT EXISTS (SELECT 1 FROM dbo.qc_asm_insp_head h WHERE h.[工单号] = p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y')
    AND NOT EXISTS (SELECT 1 FROM dbo.bd_finish_in f WHERE f.[加工单号] = p.pl_no AND ISNULL(f.asp_cancel,'N')<>'Y')
  ORDER BY p.pl_date, p.pl_no, p.pl_xc, p.id`)

const skipped = await q(`
  SELECT p.pl_no, ISNULL(p.pl_xc,0) AS pl_xc, CONVERT(varchar(10), p.pl_date, 120) AS 日期,
         CASE WHEN EXISTS (SELECT 1 FROM dbo.scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y') THEN N'报工'
              WHEN EXISTS (SELECT 1 FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y') THEN N'检验'
              ELSE N'入库' END AS 已有
  FROM dbo.plang p
  WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.pl_date, GETDATE()) < CONVERT(date,'${cutoff}')
    AND (EXISTS (SELECT 1 FROM dbo.scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y')
      OR EXISTS (SELECT 1 FROM dbo.qc_asm_insp_head h WHERE h.[工单号]=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y')
      OR EXISTS (SELECT 1 FROM dbo.bd_finish_in f WHERE f.[加工单号]=p.pl_no AND ISNULL(f.asp_cancel,'N')<>'Y'))
  ORDER BY p.pl_no, p.pl_xc`)

const recently = await q(`SELECT COUNT(*) AS n FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'
  AND ISNULL(pl_date, CONVERT(datetime,'19000101',112)) >= CONVERT(date,'${cutoff}')`)

let target = rows
if (LIMIT > 0) target = rows.slice(0, LIMIT)

/* ───────────────────────── 号池:按 (前缀, 年月) 续号 ───────────────────────── */
const seqState = new Map()
async function nextNo(lb, d) {
  const key = `${lb}|${ym(d)}`
  if (!seqState.has(key)) {
    const like = `${lb}-${ym(d)}-%`
    const tbl = lb === 'BG' ? `SELECT MAX([报工单号]) AS mx FROM dbo.scjl WHERE [报工单号] LIKE N'${like}'`
      : lb === 'ZJ' ? `SELECT MAX([单据编号]) AS mx FROM dbo.qc_asm_insp_head WHERE [单据编号] LIKE N'${like}'`
        : `SELECT MAX([单据编号]) AS mx FROM dbo.bd_finish_in WHERE [单据编号] LIKE N'${like}'`
    const r = (await q(tbl))[0]
    const pool2 = (await q(`SELECT MAX(dh) AS mx FROM dbo.s_allno WHERE lb=N'${lb}' AND ny=N'${ym(d)}'`))[0]
    const parse = (s) => { if (!s) return 0; const m = String(s).match(/(\d+)$/); return m ? Number(m[1]) : 0 }
    seqState.set(key, Math.max(parse(r.mx), parse(pool2.mx)))
  }
  const n = seqState.get(key) + 1
  seqState.set(key, n)
  return `${lb}-${ym(d)}-${pad(n, 4)}`
}

/* ───────────────────────── 计划 ───────────────────────── */
const WORKERS = ['柴善银', '刘磊', '冯敏', '陈秀丽']
const plan = []
for (let i = 0; i < target.length; i++) {
  const r = target[i]
  const lot = r.lot || r.pl_date_s.replace(/-/g, '')
  const d0 = new Date(`${r.pl_date_s}T00:00:00`)
  const days = route.map((op, k) => addDays(d0, k + 1))
  const opRows = route.map((op, k) => ({
    op: op.工序名称, ws: op.车间, seq: op.序,
    line: linesOf(op.车间)[i % linesOf(op.车间).length],
    at: days[k],
  }))
  const last = opRows[opRows.length - 1]
  plan.push({
    r, lot, lines: opRows, d0,
    qty: Number(r.pl_sl),
    worker: WORKERS[i % WORKERS.length],
    reportNos: [], zjNo: null, fiNo: null,
    closeAt: last.at,
  })
}
/* 单号在所有日期定下来之后统一发号(按日期先后,保证"单号随月份递增") */
const ordered = [...plan].sort((a, b) => (a.d0 < b.d0 ? -1 : a.d0 > b.d0 ? 1 : 0))
for (const p of ordered) {
  for (const op of p.lines) p.reportNos.push({ ...op, no: await nextNo('BG', op.at) })
  p.zjNo = await nextNo('ZJ', p.closeAt)
  p.fiNo = await nextNo('FI', p.closeAt)
}

console.log(`== ${DB} 全流程推进计划(标记 ${MARK})==`)
console.log(`  近 3 日(>= ${cutoff})工单行 ${recently[0].n} 行 —— 不处理`)
console.log(`  待推进 ${plan.length} 行(近 3 日之外、无下游单据)`)
if (skipped.length) {
  console.log(`  跳过 ${skipped.length} 行(已有业务痕迹,避免覆盖现场在做的单):`)
  for (const s of skipped.slice(0, 20)) console.log(`      ${s.pl_no}#${s.pl_xc}  ${s.日期}  已有${s.已有}`)
  if (skipped.length > 20) console.log(`      …… 共 ${skipped.length} 行`)
}
const sample = plan.slice(0, 3)
for (const p of sample) {
  console.log(`  例:${p.r.pl_no}#${p.r.pl_xc} 排产 ${p.qty} → ${p.lines.map((l) => `${l.op}@${l.line}(${ymd(l.at)})`).join(' → ')}`)
  console.log(`     报工单 ${p.reportNos.map((x) => x.no).join(' / ')}  检验 ${p.zjNo}  入库 ${p.fiNo}  → 结案`)
}
console.log(`  合计将写入:排产行(plang_pc) ${plan.length} / 报工 ${plan.length * route.length} / 检验 ${plan.length}`
  + ` / 入库 ${plan.length}(+${plan.length} 明细) / 工序任务 ${plan.length * route.length} / 单据状态 ${plan.length * (route.length + 2)}`)

if (!APPLY) { console.log('\n[预演结束] 加 --apply 才落库'); await pool.close(); process.exit(0) }

/* ───────────────────────── 回滚脚本(落库前写,崩溃也能退)───────────────────────── */
const rb = []
rb.push(`/* rollback-${DB}.sql —— 回滚 ${MARK} 生产工单全流程推进(由 _seed-wo-flow.mjs 生成) */`)
rb.push(`SET NOCOUNT ON;`)
rb.push(`DELETE FROM dbo.yj_doc_status WHERE`
  + ` (panel_code=N'WO_REPORT' AND doc_no IN (SELECT [报工单号] FROM dbo.scjl WHERE asp_user1=N'${MARK}'))`
  + ` OR (panel_code=N'QC_ASM_INSP' AND doc_no IN (SELECT [单据编号] FROM dbo.qc_asm_insp_head WHERE asp_user1=N'${MARK}'))`
  + ` OR (panel_code=N'FINISH_IN' AND doc_no IN (SELECT [单据编号] FROM dbo.bd_finish_in WHERE asp_user1=N'${MARK}'));`)
rb.push(`DELETE FROM dbo.bl_finish_in WHERE [单据编号] IN (SELECT [单据编号] FROM dbo.bd_finish_in WHERE asp_user1=N'${MARK}');`)
rb.push(`DELETE FROM dbo.bd_finish_in WHERE asp_user1=N'${MARK}';`)
rb.push(`DELETE FROM dbo.qc_asm_insp_detail WHERE [单据编号] IN (SELECT [单据编号] FROM dbo.qc_asm_insp_head WHERE asp_user1=N'${MARK}');`)
rb.push(`DELETE FROM dbo.qc_asm_insp_head WHERE asp_user1=N'${MARK}';`)
rb.push(`DELETE FROM dbo.scjl WHERE asp_user1=N'${MARK}';`)
rb.push(`DELETE FROM dbo.wo_progress WHERE asp_user1=N'${MARK}';`)
rb.push(`DELETE FROM dbo.s_allno WHERE asp_user1=N'${MARK}';`)
rb.push(`DELETE FROM dbo.plang_pc WHERE asp_user1=N'${MARK}';`)
const dt = (v) => (v ? `CONVERT(datetime,'${ymd(new Date(v))} ${pad(new Date(v).getHours())}:${pad(new Date(v).getMinutes())}:${pad(new Date(v).getSeconds())}',120)` : 'NULL')
const s = (v) => (v == null || v === '' ? 'NULL' : qn(v))
for (const p of plan) {
  const r = p.r
  rb.push(`UPDATE dbo.plang SET scx=${s(r.scx)}, rk_sl=${r.rk_sl}, rk_no=${s(r.rk_no)}, [完工状态]=${s(r.完工状态)},`
    + ` [当前工序]=${s(r.当前工序)}, [当前工序完工量]=${r.当前工序完工量}, [完工时间]=${dt(r.完工时间)}, cp_date2=${dt(r.cp_date2)},`
    + ` ja=${s(r.ja)}, [批次号]=${s(r.lot)}, asp_user1=${s(r.asp_user1)}, asp_user2=${s(r.asp_user2)} WHERE id=${r.id};   -- ${r.pl_no}#${r.pl_xc}`)
}
rb.push(`GO`)
fs.writeFileSync(RB_FILE, rb.join('\n') + '\n', 'utf8')
console.log(`\n  回滚脚本: ${RB_FILE}`)

/* ───────────────────────── 执行 ───────────────────────── */
const seeded = (await q(`SELECT (SELECT COUNT(*) FROM dbo.scjl WHERE asp_user1=N'${MARK}')`
  + ` + (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE asp_user1=N'${MARK}') AS n`))[0].n
if (seeded > 0) { console.log(`\n[跳过] 已存在本批 ${seeded} 行数据;先 --cleanup --apply`); await pool.close(); process.exit(0) }

const today = new Date()
const tx = new mssql.Transaction(pool)
await tx.begin()
const req = () => new mssql.Request(tx)
let done = 0
try {
  for (const p of plan) {
    const r = p.r
    const lineMain = p.lines[p.lines.length - 1].line          // 末道(组装)线 = 工单当前产线
    /* ① 排产行 plang_pc(报工 gd_id 的锚点) */
    const pcIns = await req().query(`
      INSERT INTO dbo.plang_pc (comm, pl_no, pl_xc, scx, pl_man, pl_date, khdm, dm, mc, gg, jldw,
        pl_sl, pl_sl2, xq_sl, rk_sl, yl, cp_date, st_date, cp_date2, rk_no, ja, od_no, od_xc, lot_no,
        [批次号], plang_id, asp_user1, asp_time1, asp_cancel)
      OUTPUT INSERTED.id AS id
      VALUES (N'0', ${qn(r.pl_no)}, ${r.pl_xc}, ${qn(lineMain)}, N'system', ${dt(p.d0)}, ${qn(r.khdm)}, ${qn(r.dm)},
        ${qn(r.mc)}, ${qn(r.gg)}, ${qn(r.jldw)}, ${p.qty}, ${r.pl_sl2}, ${r.xq_sl}, ${p.qty}, 0,
        ${dt(p.d0)}, ${dt(p.lines[0].at)}, ${dt(p.closeAt)}, ${qn(p.fiNo)}, N'Y', ${qn(r.od_no)}, ${r.od_xc},
        ${qn(p.lot)}, ${qn(p.lot)}, ${r.id}, N'${MARK}', SYSDATETIME(), N'N')`)
    const pcId = pcIns.recordset[0].id

    /* ② 三道报工(已审核) */
    for (const op of p.reportNos) {
      await req().query(`
        INSERT INTO dbo.scjl (comm, sc_no, wzdm, mc, gg, jldw, sc_date, ywman, gldh, gd_id, gxdm,
          sl, pl_sl, lot_no, wgzt, wgsj, scx, scxmc, delmark, post_no, khdm, jh_date, [报工单号],
          [工单行号], [批次号], od_no, od_xc, tm, asp_user1, asp_time1, asp_cancel)
        VALUES (N'0', ${qn(op.no)}, ${qn(r.dm)}, ${qn(r.mc)}, ${qn(r.gg)}, ${qn(r.jldw)},
          ${dt(new Date(`${ymd(op.at)}T09:15:00`))}, ${qn(p.worker)}, ${qn(r.pl_no)}, ${pcId}, ${qn(op.op)},
          ${p.qty}, ${p.qty}, ${qn(p.lot)}, N'Y', ${dt(new Date(`${ymd(op.at)}T16:40:00`))},
          ${qn(op.line)}, ${qn(op.line)}, 0, ${qn(p.fiNo)}, ${qn(r.khdm)},
          ${dt(new Date(`${ymd(op.at)}T00:00:00`))}, ${qn(op.no)}, ${r.pl_xc}, ${qn(p.lot)},
          ${qn(r.od_no)}, ${r.od_xc}, ${qn(r.pl_no)}, N'${MARK}', SYSDATETIME(), N'N')`)
      await req().query(`INSERT INTO dbo.yj_doc_status (panel_code, doc_no, shr, shsj, canceled, pending, update_at, saved, archived, deleting)
        VALUES (N'WO_REPORT', ${qn(op.no)}, ${qn(p.worker)}, ${dt(new Date(`${ymd(op.at)}T16:40:00`))},
          N'N', N'N', SYSDATETIME(), N'Y', N'N', N'N')`)
      await req().query(`INSERT INTO dbo.s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
        VALUES (N'0', ${qn(op.no)}, N'BG', N'${ym(op.at)}', N'${MARK}', SYSDATETIME(), N'N')`)
    }

    /* ③ 工序任务(3 道,已完成) */
    for (const l of p.lines) {
      await req().query(`
        INSERT INTO dbo.wo_progress (单据编号, 工序, 计划数量, 完成数量, 备注, 工单行id, [批次号], 工序序,
          生产车间, 生产线, 状态, 优先级, 计划完工日期, 产品编码, 产品名称, 规格型号, asp_cancel, asp_user1, asp_time1)
        VALUES (${qn(r.pl_no)}, ${qn(l.op)}, ${p.qty}, ${p.qty}, N'路线 GY-CB-STD', ${r.id}, ${qn(p.lot)}, ${l.seq},
          ${qn(l.ws)}, ${qn(l.line)}, N'已完工', N'普通', CONVERT(date,'${ymd(p.closeAt)}'),
          ${qn(r.dm)}, ${qn(r.mc)}, ${qn(r.gg)}, N'N', N'${MARK}', SYSDATETIME())`)
    }

    /* ④ 组装成品检验单(已审核,合格数量 = 排产) */
    const inspAt = `${ymd(p.closeAt)}T17:00:00`
    await req().query(`
      INSERT INTO dbo.qc_asm_insp_head (单据编号, 单据日期, [工单号], [批次号], 报工单号, 工序, 产品编码, 产品名称,
        规格型号, 生产线, 生产车间, 报工数量, 检验数量, 合格数量, 检验员, 检验日期, 处理方式,
        [工单行号], asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
      VALUES (${qn(p.zjNo)}, CONVERT(date,'${ymd(p.closeAt)}'), ${qn(r.pl_no)}, ${qn(p.lot)},
        ${qn(p.reportNos[p.reportNos.length - 1].no)}, N'组装', ${qn(r.dm)}, ${qn(r.mc)}, ${qn(r.gg)},
        ${qn(p.lines[p.lines.length - 1].line)}, N'组装', ${p.qty}, ${p.qty}, ${p.qty}, ${qn(p.worker)},
        CONVERT(date,'${ymd(p.closeAt)}'), ${qn(`合格转库存(${p.fiNo})`)}, ${r.pl_xc},
        N'${MARK}', SYSDATETIME(), N'admin', ${dt(new Date(inspAt))}, N'N')`)
    const items = [
      { 项目: '目数(+20目)', 要求: '+20目占比≤15%', 方法: '称取100g成品,20目/325目筛网震动筛分5min,称量计算占比' },
      { 项目: '目数(-325目)', 要求: '-325目占比≤10%', 方法: '同上筛分法,按区间占比判定' },
    ]
    for (let k = 0; k < items.length; k++) {
      await req().query(`
        INSERT INTO dbo.qc_asm_insp_detail (单据编号, 行号, 检验项目, 检验要求, 检验方法, 结果判断, 检验结果,
          合格数量, 不合格数量, 检验类型, 备注, asp_user1, asp_time1, asp_cancel)
        VALUES (${qn(p.zjNo)}, ${k + 1}, ${qn(items[k].项目)}, ${qn(items[k].要求)}, ${qn(items[k].方法)},
          N'合格', N'合格', ${p.qty}, 0, N'目数', N'YJ-Q-125 §6.2', N'${MARK}', SYSDATETIME(), N'N')`)
    }
    await req().query(`INSERT INTO dbo.yj_doc_status (panel_code, doc_no, shr, shsj, canceled, pending, update_at, saved, archived, deleting)
      VALUES (N'QC_ASM_INSP', ${qn(p.zjNo)}, ${qn(p.worker)}, ${dt(new Date(inspAt))}, N'N', N'N', SYSDATETIME(), N'Y', N'N', N'N')`)
    await req().query(`INSERT INTO dbo.s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
      VALUES (N'0', ${qn(p.zjNo)}, N'ZJ', N'${ym(p.closeAt)}', N'${MARK}', SYSDATETIME(), N'N')`)

    /* ⑤ 产成品入库单(已审核,实收 = 排产) */
    const fiAt = `${ymd(p.closeAt)}T17:10:00`
    await req().query(`
      INSERT INTO dbo.bd_finish_in (单据日期, 单据编号, 业务类型, 入库类别, 生产车间, 加工单号, 经手人, 仓库,
        备注, 单据状态, 审核人, 审核时间, [批次号], 工单行号, 创建时间, asp_user1, asp_time1, asp_cancel)
      VALUES (CONVERT(date,'${ymd(p.closeAt)}'), ${qn(p.fiNo)}, N'产品入库单', N'产成品入库', N'组装', ${qn(r.pl_no)},
        ${qn(p.worker)}, N'C仓', ${qn(`组装成品检验单 ${p.zjNo} 合格数量 ${p.qty} 转库`)}, N'已审核',
        ${qn(p.worker)}, ${dt(new Date(fiAt))}, ${qn(p.lot)}, ${r.pl_xc}, ${dt(new Date(fiAt))},
        N'${MARK}', SYSDATETIME(), N'N')`)
    await req().query(`
      INSERT INTO dbo.bl_finish_in (单据编号, 产品名称, 仓库, 规格型号, 计量单位, 金额, 单价, 实收数量,
        产品编码, 批号, 序号, asp_user1, asp_time1, asp_cancel)
      VALUES (${qn(p.fiNo)}, ${qn(r.mc)}, N'C仓', ${qn(r.gg)}, ${qn(r.jldw)}, 0, 0, ${p.qty},
        ${qn(r.dm)}, ${qn(p.lot)}, 1, N'${MARK}', SYSDATETIME(), N'N')`)
    await req().query(`INSERT INTO dbo.yj_doc_status (panel_code, doc_no, shr, shsj, canceled, pending, update_at, saved, archived, deleting)
      VALUES (N'FINISH_IN', ${qn(p.fiNo)}, ${qn(p.worker)}, ${dt(new Date(fiAt))}, N'N', N'N', SYSDATETIME(), N'Y', N'N', N'N')`)
    await req().query(`INSERT INTO dbo.s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
      VALUES (N'0', ${qn(p.fiNo)}, N'FI', N'${ym(p.closeAt)}', N'${MARK}', SYSDATETIME(), N'N')`)

    /* ⑥ 工单行推进到已结案 */
    await req().query(`
      UPDATE dbo.plang SET scx=${qn(lineMain)}, [批次号]=COALESCE(NULLIF([批次号],N''),${qn(p.lot)}),
        st_date=COALESCE(st_date, ${dt(p.lines[0].at)}), cp_date2=${dt(p.closeAt)},
        rk_sl=${p.qty}, rk_no=${qn(p.fiNo)}, [完工状态]=N'生产完工', [当前工序]=N'组装',
        [当前工序完工量]=${p.qty}, [完工时间]=${dt(new Date(`${ymd(p.closeAt)}T17:00:00`))},
        ja=N'Y', asp_user1=N'${MARK}', asp_user2=N'${MARK}', asp_time2=SYSDATETIME()
      WHERE id=${r.id} AND ISNULL(asp_cancel,'N')<>'Y'`)
    done++
    if (done % 50 === 0) console.log(`  ...已推进 ${done}/${plan.length}`)
  }
  await tx.commit()
  console.log(`\n[完成] ${DB}:${done} 行推进到已结案`)
} catch (e) {
  await tx.rollback()
  console.log('\n[失败并回滚] ' + e.message)
  process.exitCode = 1
}
await pool.close()
