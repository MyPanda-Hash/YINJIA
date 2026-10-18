/**
 * _seed-demo-flow.mjs —— 生产链演示数据播种(2026-10-16 验收专项)
 *
 * 【用户口径】「生产一直是生产中都没有已完工,还有其他视图数据等,不够真实,无法项目验收」。
 *
 * 【为什么"一直是生产中"】实测(HSDZ_MES):
 *   · plang 429 行 → **有产线(scx 非空)= 0**(全未排产)、**有入库单号(rk_no)= 0**(看板「已完工」判据就是它);
 *   · scjl(报工事实账)**全库只有 7 行且都在 2026-08**,还是老系统的电镀线数据、`gxdm` 全空、`报工单号` 全 NULL;
 *   ⇒ 车间生产分布(按 scx 分组)、五工序报工完成率(按 gxdm 分组)、产能对比(读 scjl.scxmc)必然空/全 0。
 *
 * 【播种口径(与引擎一致,不是瞎填)】
 *   · 工单路线全部是 `GY-CB-STD 炭棒标准路线`,工序链 = **成型 → 切炭 → 组装**(库里就三道);
 *   · `scjl.gxdm` 存的是**工序名称**(WoReportService 拿它比对 bs_route.工序名称,且校验"不跳序");
 *   · 报工单号前缀 **BG**(yj_panel WO_REPORT.prefix),完成一道工序 = 一张报工单;
 *   · 完工判据对齐看板与 `ScheduleBoardService.DONE_ROW`:rk_no 非空 + 完工状态='生产完工' + cp_date2;
 *   · 报工行同时满足 `v_wo_completion_detail`(RTRIM(wgzt)='Y'),让「完工明细」面板也有真实行。
 *
 * 【安全】只动 3 处,全部可回滚:
 *   ① plang 选定 12 行的排产/完工字段;② scjl 追加报工行(带标记 asp_user1='demo-flow-20261016');
 *   ③ bs_prod_line 未维护的日产能补齐 + s_allno 登记 BG 单号(防以后再取号撞号)。
 *   **不碰库存流水 inh/outh、不碰任何库存/报表口径。** 成对产出 rollback-<DB>.sql。
 *
 * 用法:
 *   node tools/archive/_demo-flow-20261016/_seed-demo-flow.mjs --db HSDZ_MES            # 预演(只打印计划)
 *   node tools/archive/_demo-flow-20261016/_seed-demo-flow.mjs --db HSDZ_MES --apply    # 执行
 *   node tools/archive/_demo-flow-20261016/_seed-demo-flow.mjs --db HSDZ_MES --cleanup  # 按标记清理
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? (process.argv[i + 1]?.startsWith('--') ? true : process.argv[i + 1]) : d }
const DB = arg('db', 'HSDZ_MES')
const APPLY = process.argv.includes('--apply')
const CLEANUP = process.argv.includes('--cleanup')
const MARK = 'demo-flow-20261016'
const OUT = import.meta.dirname

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const day = (d) => new Date(d).toISOString().slice(0, 10)
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

/* ───────────────────────── 清理 ───────────────────────── */
if (CLEANUP) {
  const n1 = (await q(`SELECT COUNT(*) AS n FROM scjl WHERE asp_user1 = N'${MARK}'`))[0].n
  const n2 = (await q(`SELECT COUNT(*) AS n FROM plang WHERE asp_user1 = N'${MARK}'`))[0].n
  const n3 = (await q(`SELECT COUNT(*) AS n FROM bs_prod_line WHERE asp_user1 = N'${MARK}'`))[0].n
  if (!APPLY) {
    console.log(`[预演] 将删除:scjl ${n1} 行、plang 复位 ${n2} 行、bs_prod_line 复位 ${n3} 行、s_allno 删除 BG ${(await q(`SELECT COUNT(*) AS n FROM s_allno WHERE asp_user1 = N'${MARK}'`))[0].n} 行`)
    process.exit(0)
  }
  const rb = await q(`SELECT id, scx, pl_sl, rk_no, rk_sl, [完工状态], cp_date2, asp_time2 FROM plang WHERE asp_user1 = N'${MARK}'`)
  await pool.request().query(`DELETE FROM yj_doc_status WHERE panel_code = N'WO_REPORT' AND doc_no LIKE N'BG-%'`)
  await pool.request().query(`DELETE FROM scjl WHERE asp_user1 = N'${MARK}'`)
  for (const r of rb) {
    await pool.request().query(`UPDATE plang SET scx=NULL, rk_no=NULL, rk_sl=NULL, [完工状态]=NULL, cp_date2=NULL,
      asp_time2=NULL, asp_user1=NULL WHERE id=${r.id}`)
  }
  await pool.request().query(`DELETE FROM s_allno WHERE asp_user1 = N'${MARK}'`)
  await pool.request().query(`UPDATE bs_prod_line SET 日产能=NULL, asp_user1=NULL WHERE asp_user1 = N'${MARK}'`)
  console.log(`[完成] 已清理:scjl ${n1} 行 / plang 复位 ${rb.length} 行 / bs_prod_line ${n3} 行 / s_allno BG 行`)
  await pool.close()
  process.exit(0)
}

/* ───────────────────────── 选目标工单:跨近 30 天均匀取样 ───────────────────────── */
const cands = await q(`SELECT id, pl_no, pl_xc, dm, mc, ISNULL(gg,'') AS gg, ISNULL(jldw,N'支') AS jldw, xq_sl, pl_sl,
    ISNULL(khdm,N'') AS khdm, ISNULL(od_no,N'') AS od_no, ISNULL([批次号],N'') AS lot, pl_date
  FROM plang
  WHERE pl_date >= DATEADD(day,-30,CONVERT(date,GETDATE())) AND ISNULL(scx,N'')=N''
    AND ISNULL(xq_sl,0) > 0 AND ISNULL(dm,N'') <> N'' AND ISNULL(asp_user1,N'') <> N'${MARK}'
  ORDER BY pl_date DESC, id`)
const N = 12
const picked = []
if (cands.length) {
  const byBucket = {}
  for (const r of cands) {
    const age = Math.floor((Date.now() - new Date(r.pl_date).getTime()) / 86400000 / 5)   // 每 5 天一个桶
    ;(byBucket[age] = byBucket[age] || []).push(r)
  }
  const buckets = Object.keys(byBucket).map(Number).sort((a, b) => a - b)
  let i = 0
  while (picked.length < N && i < 100) {
    for (const b of buckets) { const arr = byBucket[b]; if (arr.length && picked.length < N) picked.push(arr.shift()) }
    i++
  }
}

/* ───────────────────────── 常量 ───────────────────────── */
const LINES = { 成型: ['成型1线', '成型2线', '成型3线', '成型4线', '成型5线'], 切炭: ['切炭线'], 组装: ['组装线', '装箱线'] }
const OPS = ['成型', '切炭', '组装']       // GY-CB-STD 的工序链(工序名称)
const WORKERS = ['柴善银', '刘磊', '冯敏', '陈秀丽']
/* 完成度按"越新的单越靠前段"分布(真实车间就是这样):最新 3 单只做完成型、中段做完两道、老单三道全完。
   这样 ① 完工数 ≥3(工单状态分布不再恒"生产中")② 三道工序完成率递减、不是假的 100%。 */
const DONE_PLAN = picked.map((_, i) => (i < 3 ? 1 : i < 7 ? 2 : 3))
/* 成型里留 1 张只"报工未审" → 成型完成率 11/12,不是 100% */
const UNFINISHED = new Set([11])

const plan = []
for (let i = 0; i < picked.length; i++) {
  const r = picked[i]
  const line0 = LINES.成型[i % LINES.成型.length]
  const start = addDays(new Date(r.pl_date), 1)
  const doneQty = DONE_PLAN[i]
  const rows = []
  for (let k = 0; k < OPS.length; k++) {
    const op = OPS[k]
    const lineName = LINES[op][i % LINES[op].length]
    const d = addDays(start, k)                    // 三道工序逐日推进
    if (d > new Date()) break                      // 不让报工日期跑到未来
    const audited = k < doneQty && !(k === 0 && UNFINISHED.has(i))
    rows.push({
      op, line: lineName, date: day(d), qty: Number(r.pl_sl || r.xq_sl || 0),
      wgzt: audited ? 'Y' : null, worker: WORKERS[(i + k) % WORKERS.length],
      no: null, jc: null, post: null,
    })
  }
  plan.push({ row: r, line0, start: day(start), rows, finished: false })
}

/**
 * 让「产能对比·日」视图有内容:该卡的口径是「最近有报工的那个周期」(DashboardStatsService.capacity),
 * 所以**最新的几单要把首道工序(成型)排到今天/昨天**,并且落在不同产线上 ——
 * 一天里多条成型线同时开工是车间常态。⚠ 只挪**首道工序**的日期,后道保持原日期:
 * 这样不会因为"不许报工日期跑到未来"把整单截断、把已完工工单变成在制。
 */
const todayD = day(new Date())
for (let i = 0; i < plan.length && i < 3; i++) {
  const p = plan[i]
  if (!p.rows.length) continue
  /* 这三张"今天刚开成型":只保留**首道工序**那一行(后道还没做,保留会与其后道日期倒挂),
     产线按 i 轮转 = 成型1/2/3线 ⇒ 产能"日"视图今天就有 3 条线在产。 */
  p.rows[0].date = todayD
  p.rows = [p.rows[0]]
  p.finished = false
}
/** 单号在**所有日期确定之后**按时间顺序统一发号(月内递增),避免出现"10 月的单号配 9 月的日期" */
const monthSeq = {}
const BG = (d) => {
  const ym = day(d).slice(0, 7)
  monthSeq[ym] = (monthSeq[ym] || 0) + 1
  return `BG-${ym}-${String(monthSeq[ym]).padStart(4, '0')}`
}
const JC = (d, n) => 'RK' + day(d).replace(/-/g, '').slice(2) + String(n).padStart(4, '0')
const FI = (d, n) => `FI-${day(d).slice(0, 7)}-${String(n).padStart(4, '0')}`
let jcSeq = 0
for (const p of plan) {
  p.rows.sort((a, b) => (a.date < b.date ? -1 : 1))
  for (const w of p.rows) {
    w.no = BG(w.date)
    if (w.wgzt === 'Y') w.jc = JC(w.date, ++jcSeq)
  }
  /* 末道工序已审核 = 完工 → 回写产成品入库单号 */
  const last = p.rows[p.rows.length - 1]
  if (last && last.wgzt === 'Y') last.post = FI(last.date, plan.indexOf(p) + 1)
  p.finished = p.rows.length === OPS.length && p.rows.every((r) => r.wgzt === 'Y')
}

console.log(`== ${DB} 播种计划(标记 ${MARK})==`)
console.log(`  候选工单 ${cands.length} 行,取样 ${plan.length} 行\n`)
for (const p of plan) {
  const r = p.row
  console.log(`  工单 ${r.pl_no}#${r.pl_xc}  ${String(r.dm).padEnd(10)} 需求 ${String(r.xq_sl).padStart(6)} 排产到「${p.line0}」 ${p.finished ? '→ 完工' : '→ 在制'}`)
  for (const w of p.rows) console.log(`      报工单 ${w.no}  ${w.date}  ${w.op.padEnd(3)} @${String(w.line).padEnd(6)} 数量 ${String(w.qty).padStart(6)}  ${w.wgzt ? '已审核' : '草稿(未审)'}  ${w.worker}`)
}
const totalBg = plan.reduce((a, p) => a + p.rows.length, 0)
console.log(`\n  合计:排产 ${plan.length} 行 / 报工单 ${totalBg} 张 / 完工 ${plan.filter((p) => p.finished).length} 行 / 产线日产能补齐 + s_allno BG ${totalBg} 行`)

/* ───────────────────────── 生成回滚 ───────────────────────── */
const rb = []
rb.push(`/* rollback-${DB}.sql —— 回滚 ${MARK} 生产链演示数据(按标记;由 _seed-demo-flow.mjs 生成) */`)
rb.push(`SET NOCOUNT ON;`)
rb.push(`DELETE FROM yj_doc_status WHERE panel_code = N'WO_REPORT' AND doc_no LIKE N'BG-%';   -- yj_doc_status 无标记列,按"报工单面板 + BG 单号前缀"识别(库里原本没有 BG 单)`)
rb.push(`DELETE FROM scjl WHERE asp_user1 = N'${MARK}';`)
rb.push(`DELETE FROM s_allno WHERE asp_user1 = N'${MARK}';`)
rb.push(`UPDATE bs_prod_line SET 日产能 = NULL, asp_user1 = NULL WHERE asp_user1 = N'${MARK}';`)
for (const p of plan) {
  rb.push(`UPDATE plang SET scx = NULL, rk_no = NULL, rk_sl = NULL, [完工状态] = NULL, cp_date2 = NULL, asp_time2 = NULL, asp_user1 = NULL WHERE id = ${p.row.id};   -- ${p.row.pl_no}#${p.row.pl_xc}`)
}
rb.push(`GO`)
const rbFile = path.join(OUT, `rollback-${DB}.sql`)
if (APPLY) fs.writeFileSync(rbFile, rb.join('\n') + '\n', 'utf8')
console.log(`\n  回滚脚本: ${APPLY ? rbFile : '(执行时写入 ' + rbFile + ')'}`)

if (!APPLY) { console.log('\n[预演结束] 加 --apply 才落库'); await pool.close(); process.exit(0) }

/* ───────────────────────── 执行 ───────────────────────── */
const seeded = (await q(`SELECT COUNT(*) AS n FROM scjl WHERE asp_user1 = N'${MARK}'`))[0].n
if (seeded > 0) { console.log(`\n[跳过] 已存在 ${seeded} 行标记数据;先 --cleanup 再播种`); await pool.close(); process.exit(0) }

const tx = new mssql.Transaction(pool)
await tx.begin()
const req = () => new mssql.Request(tx)
try {
  /* ① 产线日产能补齐(同车间已维护的值作为口径:成型 20000 / 切炭 30000 / 组装 25000) */
  const cap = { 成型: 20000, 切炭: 30000, 组装: 25000 }
  for (const [ws, v] of Object.entries(cap)) {
    await req().query(`UPDATE bs_prod_line SET 日产能 = ${v}, asp_user1 = N'${MARK}'
      WHERE 生产车间 = N'${ws}' AND ISNULL(日产能,0) = 0 AND ISNULL(asp_cancel,'N') <> 'Y'`)
  }
  /* ② 工单:排产 + (完工的)入库回写 */
  for (const p of plan) {
    const r = p.row
    const plSl = Number(r.pl_sl || r.xq_sl || 0)
    await req().query(`UPDATE plang SET scx = N'${p.line0}', pl_sl = ${plSl},
        asp_time2 = CONVERT(datetime, '${p.start} 08:30:00', 120),
        rk_no = ${p.finished ? `N'${FI(addDays(new Date(p.start), 3), picked.indexOf(r) + 1)}'` : 'NULL'},
        rk_sl = ${p.finished ? plSl : 'NULL'},
        [完工状态] = ${p.finished ? "N'生产完工'" : 'NULL'},
        cp_date2 = ${p.finished ? `CONVERT(datetime, '${day(addDays(new Date(p.start), 3))} 17:00:00', 120)` : 'NULL'},
        asp_user1 = N'${MARK}'
      WHERE id = ${r.id}`)
  }
  /* ③ 报工行(scjl)——字段按 WO_REPORT / WO_REPORT_LIST / WO_COMPLETION_LIST 登记项填全 */
  let pendingLeft = 2   // 留 2 张「已提交待审批」,让概览「待审批」不为 0、审批动作可演示
  for (const p of plan) {
    const r = p.row
    for (const w of p.rows) {
      const lot = r.lot || `PC${day(r.pl_date).replace(/-/g, '').slice(2)}${String(r.id).padStart(6, '0')}`
      await req().query(`INSERT INTO scjl (comm, sc_no, wzdm, mc, gg, jldw, sc_date, ywman, gldh, gd_id, gxdm, sl, pl_sl,
          lot_no, wgzt, wgsj, scx, scxmc, delmark, jc_no, post_no, khdm, jh_date,
          [报工单号], [工单行号], [批次号], asp_user1, asp_time1)
        VALUES (N'0', N'${w.no}', N'${r.dm}', N'${String(r.mc).replace(/'/g, "''")}', N'${String(r.gg).replace(/'/g, "''")}', N'${r.jldw}',
          CONVERT(datetime, '${w.date} 09:15:00', 120), N'${w.worker}', N'${r.pl_no}', ${r.id}, N'${w.op}', ${w.qty}, ${w.qty},
          N'${lot}', ${w.wgzt ? "N'Y'" : 'NULL'}, ${w.wgzt ? `CONVERT(datetime, '${w.date} 16:40:00', 120)` : 'NULL'},
          N'${w.line}', N'${w.line}', 0, ${w.jc ? `N'${w.jc}'` : 'NULL'}, ${w.post ? `N'${w.post}'` : 'NULL'},
          N'${r.khdm}', CONVERT(datetime, '${w.date} 00:00:00', 120),
          N'${w.no}', ${r.pl_xc}, N'${lot}', N'${MARK}', GETDATE())`)
      /* 号池登记(防以后取号撞号) */
      await req().query(`INSERT INTO s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
        VALUES (N'0', N'${w.no}', N'BG', N'${w.date.slice(0, 7)}', N'${MARK}', GETDATE(), N'N')`)
      /* 单据状态机:已审核的写审核留痕(概览「最新动态」/报工单面板状态都读它);
         未审核的前两张写成「已提交待审批」—— 这样概览「待审批」不为 0,审批动作演示得出来。
         ⚠ yj_doc_status **没有 asp_user1 列**(2026-10-16 实测),所以这张表的造数按
         `panel_code='WO_REPORT' AND doc_no LIKE 'BG-%'` 识别与清理(库里原本一张 BG 单都没有)。 */
      const pendingDemo = !w.wgzt && pendingLeft > 0
      if (pendingDemo) pendingLeft--
      await req().query(`INSERT INTO yj_doc_status (panel_code, doc_no, shr, shsj, canceled, pending, pending_by, pending_at,
          update_at, saved, archived, deleting, approve_node)
        VALUES (N'WO_REPORT', N'${w.no}',
          ${w.wgzt ? `N'${w.worker}'` : 'NULL'},
          ${w.wgzt ? `CONVERT(datetime, '${w.date} 16:40:00', 120)` : 'NULL'},
          N'N', N'${pendingDemo ? 'Y' : 'N'}',
          ${pendingDemo ? `N'${w.worker}'` : 'NULL'},
          ${pendingDemo ? `CONVERT(datetime, '${w.date} 11:20:00', 120)` : 'NULL'},
          GETDATE(), N'Y', N'N', N'N', ${w.wgzt ? 'NULL' : '1'})`)
    }
  }
  await tx.commit()
  console.log('\n[完成] 已落库(可回滚)')
} catch (e) {
  await tx.rollback()
  console.log('\n[失败并回滚] ' + e.message)
  process.exitCode = 1
}
await pool.close()
