/**
 * _seed-wo-picking.mjs —— 给「已结案」的生产工单补材料出库单(领料单)。2026-10-18
 *
 * 【用户口径】
 *   「怎么一个个都没有领料数据」「写一下数据就行了。当前没有相关 BOM 的」——
 *   即:**没有 BOM 可算**,按物料档案写一批合理的领料明细即可,让工单列表的「领料单号」逐行点亮。
 *
 * 【落点(与系统自身口径一致)】
 *   · `bd_material_out`(材料出库单,MATERIAL_OUT,前缀 CL):
 *     `加工单号 = 工单号`、`工单行号 = plang.pl_xc`、业务类型=材料出库、出库类别=直接领料、单据状态=已审核;
 *   · `bl_material_out`(明细):主料 / 辅料 / 包材 三行,数量按排产数量折算(见下);
 *   · `yj_doc_status`:shr 非空 ⇒ ManuWritebackService.refreshPickList 才会把它算进「已审核领料」;
 *   · 回写 `plang.ll_no2`(生产工单列表「领料单号」列 + 排产看板同源)。
 *
 * 【数量口径(没有 BOM,按工艺常识折算,固定可复现)】
 *   · 主料(裸棒/炭粉):排产数量 × 1.02(含 2% 损耗)
 *   · 辅料(无纺布/PP棉/折叠棉/网套):排产数量 × 1
 *   · 包材(纸箱):ceil(排产数量 / 50);标签:排产数量 × 1
 *   物料按 产品编码 hash 轮转取(同一产品每批都取到同一组料,可复现)。
 *
 * 【不碰】库存流水 inh/outh/kucun(与上一批一致,只写单据不记账);已有领料单的工单行跳过。
 *
 * 用法(cd tools):
 *   node archive/_wo-flow-20261018/_seed-wo-picking.mjs --db HSDZ_MES            # 预演
 *   node archive/_wo-flow-20261018/_seed-wo-picking.mjs --db HSDZ_MES --apply    # 执行
 *   node archive/_wo-flow-20261018/_seed-wo-picking.mjs --db HSDZ_MES --verify   # 只读体检
 *   node archive/_wo-flow-20261018/_seed-wo-picking.mjs --db HSDZ_MES --cleanup --apply
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
const MARK = 'wo-pick-20261018'
const OUT = import.meta.dirname
const RB_FILE = path.join(OUT, `rollback-picking-${DB}.sql`)

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
const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) % 1000003; return h }
const round2 = (n) => Math.round(n * 100) / 100

/* ───────────────────────── 体检 ───────────────────────── */
if (VERIFY) {
  const s = (await q(`
    SELECT (SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(ja,'N') IN (N'T',N'Y') AND ISNULL(asp_cancel,'N')<>'Y') AS 已结案,
           (SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(ja,'N') IN (N'T',N'Y') AND ISNULL(asp_cancel,'N')<>'Y'
              AND ISNULL(ll_no2,N'')<>N'') AS 有领料单号,
           (SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(ja,'N') IN (N'T',N'Y') AND ISNULL(asp_cancel,'N')<>'Y'
              AND ll_no2 LIKE N'CL-%') AS 有CL领料单号,
           (SELECT COUNT(*) FROM dbo.bd_material_out WHERE asp_user1=N'${MARK}') AS 本批领料单,
           (SELECT COUNT(*) FROM dbo.bl_material_out WHERE asp_user1=N'${MARK}') AS 本批明细,
           (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE panel_code=N'MATERIAL_OUT'
              AND doc_no IN (SELECT [单据编号] FROM dbo.bd_material_out WHERE asp_user1=N'${MARK}')) AS 本批审核状态`))[0]
  console.log(`== ${DB} 领料体检 ==`)
  console.log(`  已结案 ${s.已结案} / 有领料单号 ${s.有领料单号} / 本批领料单 ${s.本批领料单}(明细 ${s.本批明细},审核状态 ${s.本批审核状态})`)
  const bad = (await q(`
    SELECT COUNT(*) AS n FROM dbo.plang p WHERE ISNULL(p.ja,'N') IN (N'T',N'Y') AND ISNULL(p.asp_cancel,'N')<>'Y'
      AND p.ll_no2 LIKE N'CL-%'
      AND NOT EXISTS (SELECT 1 FROM dbo.bd_material_out h JOIN dbo.yj_doc_status ds
          ON ds.panel_code=N'MATERIAL_OUT' AND ds.doc_no=h.[单据编号]
        WHERE h.[加工单号]=p.pl_no AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0)
          AND ISNULL(h.asp_cancel,'N')<>'Y' AND ds.shr IS NOT NULL AND ISNULL(ds.canceled,'N')<>'Y')`))[0]
  console.log(`  领料单号挂空(CL- 号指向不存在的已审领料单)${bad.n}(应为 0)`)
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

/* ───────────────────────── 取物料档案 ───────────────────────── */
/* 只取"按支/张/个计"的料 —— 卷/kg/米的折算口径与 BOM 有关,没有 BOM 时不猜 */
const PIECE_UNITS = ['支', '张', '个', '条', '套', 'PCS']
const mats = await q(`SELECT 存货编码, 存货名称, ISNULL(规格型号,N'') AS 规格型号, 计量单位, 所属类别
  FROM dbo.bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(停用,0)=0
    AND 所属类别 IN (N'裸棒', N'无纺布', N'PP棉', N'折叠棉', N'网套', N'纸箱', N'标签')
  ORDER BY 存货编码`)
const piece = mats.filter((m) => PIECE_UNITS.includes((m.计量单位 || '').trim()))
const byCat = (c) => piece.filter((m) => m.所属类别 === c)
const rodByCode = new Map(byCat('裸棒').map((m) => [m.存货编码, m]))
const rodBySpec = new Map()
for (const m of byCat('裸棒')) {
  const k = (m.规格型号 || '').trim()
  if (k && !rodBySpec.has(k)) rodBySpec.set(k, m)
}
const auxCat = ['无纺布', 'PP棉', '折叠棉', '网套'].find((c) => byCat(c).length) || '无纺布'
const packCat = byCat('纸箱').length ? '纸箱' : '标签'
if (!byCat('裸棒').length) { console.log('[中止] bs_inv 里没有可用原料(裸棒)'); await pool.close(); process.exit(1) }

/* 产线 → 车间(单头「生产车间」取产线档案属性) */
const lineWs = {}
for (const l of await q(`SELECT 生产线, ISNULL(生产车间,N'') AS 车间 FROM dbo.bs_prod_line WHERE ISNULL(asp_cancel,'N')<>'Y'`)) {
  lineWs[l.生产线] = l.车间
}

/* ───────────────────────── 目标工单行 ───────────────────────── */
const rows = await q(`
  SELECT p.id, p.pl_no, ISNULL(p.pl_xc,0) AS pl_xc, ISNULL(p.dm,N'') AS dm, ISNULL(p.mc,N'') AS mc,
         ISNULL(p.gg,N'') AS gg,
         ISNULL(p.pl_sl,0) AS pl_sl, ISNULL(p.scx,N'') AS scx, ISNULL(p.[批次号],N'') AS lot,
         ISNULL(CONVERT(varchar(10), p.pl_date, 120), N'') AS pl_date_s,
         ISNULL(p.ll_no2,N'') AS ll_no2
  FROM dbo.plang p
  WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') IN (N'T',N'Y')
    AND NOT EXISTS (SELECT 1 FROM dbo.bd_material_out h JOIN dbo.yj_doc_status ds
        ON ds.panel_code=N'MATERIAL_OUT' AND ds.doc_no=h.[单据编号]
        WHERE h.[加工单号]=p.pl_no AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0)
          AND ISNULL(h.asp_cancel,'N')<>'Y' AND ds.shr IS NOT NULL AND ISNULL(ds.canceled,'N')<>'Y')
  ORDER BY p.pl_no, p.pl_xc, p.id`)
const skipped = await q(`
  SELECT COUNT(*) AS n FROM dbo.plang p
  WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') IN (N'T',N'Y')
    AND EXISTS (SELECT 1 FROM dbo.bd_material_out h JOIN dbo.yj_doc_status ds
        ON ds.panel_code=N'MATERIAL_OUT' AND ds.doc_no=h.[单据编号]
        WHERE h.[加工单号]=p.pl_no AND ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0)
          AND ISNULL(h.asp_cancel,'N')<>'Y' AND ds.shr IS NOT NULL AND ISNULL(ds.canceled,'N')<>'Y')`)

let target = rows
if (LIMIT > 0) target = rows.slice(0, LIMIT)

/* ───────────────────────── 号池 CL ───────────────────────── */
const seqState = new Map()
async function nextNo(d) {
  const key = ym(d)
  if (!seqState.has(key)) {
    const mx = (await q(`SELECT MAX([单据编号]) AS mx FROM dbo.bd_material_out WHERE [单据编号] LIKE N'CL-${key}-%'`))[0]
    const mx2 = (await q(`SELECT MAX(dh) AS mx FROM dbo.s_allno WHERE lb=N'CL' AND ny=N'${key}'`))[0]
    const parse = (s) => { if (!s) return 0; const m = String(s).match(/(\d+)$/); return m ? Number(m[1]) : 0 }
    seqState.set(key, Math.max(parse(mx.mx), parse(mx2.mx)))
  }
  const n = seqState.get(key) + 1
  seqState.set(key, n)
  return `CL-${key}-${pad(n, 4)}`
}

const WORKERS = ['柴善银', '刘磊', '冯敏', '陈秀丽']
const plan = []
for (const r of target) {
  const d0 = r.pl_date_s ? new Date(`${r.pl_date_s}T00:00:00`) : new Date()
  const h = hash(r.dm)
  /* 主料优先级:成品编码 + "**TB"(同产品的裸棒)→ 该编码本身(档案里属裸棒)→ 同规格裸棒 → hash 兜底 */
  const main = rodByCode.get(r.dm + '**TB') || rodByCode.get(r.dm)
    || rodBySpec.get((r.gg || '').trim()) || byCat('裸棒')[h % byCat('裸棒').length]
  const aux = byCat(auxCat)[h % byCat(auxCat).length]
  const pack = byCat(packCat)[h % byCat(packCat).length]
  const qty = Number(r.pl_sl) || 0
  const packQty = packCat === '纸箱' ? Math.max(1, Math.ceil(qty / 50)) : qty
  plan.push({
    r, d0, worker: WORKERS[h % WORKERS.length], no: await nextNo(d0),
    lines: [
      { m: main, q: round2(qty * 1.02) },
      { m: aux, q: round2(qty) },
      { m: pack, q: round2(packQty) },
    ],
  })
}

console.log(`== ${DB} 领料补数计划(标记 ${MARK})==`)
console.log(`  已结案工单行 ${rows.length + Number(skipped[0].n)} 行;其中已有领料单 ${skipped[0].n} 行(跳过)`)
console.log(`  待补领料 ${plan.length} 行 → 材料出库单 ${plan.length} 张 / 明细 ${plan.length * 3} 行`)
console.log(`  物料口径:主料=同产品裸棒(优先 编码+**TB,其次同规格) / 辅料=${auxCat} / 包材=${packCat}(纸箱按 1/50 折算)`)
for (const p of plan.slice(0, 3)) {
  console.log(`  例 ${p.r.pl_no}#${p.r.pl_xc} 排产 ${p.r.pl_sl} → ${p.no} ${ymd(p.d0)}`)
  for (const l of p.lines) console.log(`      ${l.m.存货编码} ${l.m.存货名称} ${l.q} ${l.m.计量单位}`)
}

if (!APPLY) { console.log('\n[预演结束] 加 --apply 才落库'); await pool.close(); process.exit(0) }

/* ───────────────────────── 回滚脚本 ───────────────────────── */
const rb = []
rb.push(`/* rollback-picking-${DB}.sql —— 回滚 ${MARK} 生产领料补数 */`)
rb.push(`SET NOCOUNT ON;`)
rb.push(`DELETE FROM dbo.yj_doc_status WHERE panel_code=N'MATERIAL_OUT' AND doc_no IN`
  + ` (SELECT [单据编号] FROM dbo.bd_material_out WHERE asp_user1=N'${MARK}');`)
rb.push(`DELETE FROM dbo.bl_material_out WHERE asp_user1=N'${MARK}';`)
rb.push(`DELETE FROM dbo.bd_material_out WHERE asp_user1=N'${MARK}';`)
rb.push(`DELETE FROM dbo.s_allno WHERE asp_user1=N'${MARK}';`)
for (const p of plan) {
  rb.push(`UPDATE dbo.plang SET ll_no2=${p.r.ll_no2 ? qn(p.r.ll_no2) : 'NULL'} WHERE id=${p.r.id};   -- ${p.r.pl_no}#${p.r.pl_xc}`)
}
rb.push(`GO`)
fs.writeFileSync(RB_FILE, rb.join('\n') + '\n', 'utf8')
console.log(`\n  回滚脚本: ${RB_FILE}`)

/* ───────────────────────── 执行 ───────────────────────── */
const seeded = (await q(`SELECT COUNT(*) AS n FROM dbo.bd_material_out WHERE asp_user1=N'${MARK}'`))[0].n
if (seeded > 0) { console.log(`\n[跳过] 已有本批 ${seeded} 张;先 --cleanup --apply`); await pool.close(); process.exit(0) }

const tx = new mssql.Transaction(pool)
await tx.begin()
const req = () => new mssql.Request(tx)
let done = 0
try {
  for (const p of plan) {
    const r = p.r
    const ws = lineWs[r.scx] || '组装'
    const at = `${ymd(p.d0)} 10:20:00`
    await req().query(`
      INSERT INTO dbo.bd_material_out (单据日期, 单据编号, 业务类型, 生产车间, 出库类别, 领用人, 仓库,
        来源单号, 加工单号, 备注, 单据状态, 审核人, 审核时间, 来源单据, [工单行号], 创建时间,
        asp_user1, asp_time1, asp_cancel)
      VALUES (CONVERT(date,'${ymd(p.d0)}'), ${qn(p.no)}, N'材料出库', ${qn(ws)}, N'直接领料', ${qn(p.worker)}, N'A仓',
        ${qn(r.pl_no)}, ${qn(r.pl_no)},
        ${qn(`生产工单转领料单(工单行 ${r.pl_xc},第 1 张,批次 ${r.lot},排产 ${r.pl_sl})`)}, N'已审核',
        ${qn(p.worker)}, ${dt(at)}, N'生产工单', ${r.pl_xc}, ${dt(at)},
        N'${MARK}', SYSDATETIME(), N'N')`)
    for (const l of p.lines) {
      await req().query(`
        INSERT INTO dbo.bl_material_out (单据编号, 仓库, 加工单号, 材料名称, 计量单位, 数量, 单价, 金额,
          规格型号, 材料编码, 批号, asp_user1, asp_time1, asp_cancel)
        VALUES (${qn(p.no)}, N'A仓', ${qn(r.pl_no)}, ${qn(l.m.存货名称)}, ${qn(l.m.计量单位)}, ${l.q}, 0, 0,
          ${qn(l.m.规格型号)}, ${qn(l.m.存货编码)}, ${qn(r.lot)}, N'${MARK}', SYSDATETIME(), N'N')`)
    }
    await req().query(`INSERT INTO dbo.yj_doc_status (panel_code, doc_no, shr, shsj, canceled, pending, update_at, saved, archived, deleting)
      VALUES (N'MATERIAL_OUT', ${qn(p.no)}, ${qn(p.worker)}, ${dt(at)}, N'N', N'N', SYSDATETIME(), N'Y', N'N', N'N')`)
    await req().query(`INSERT INTO dbo.s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
      VALUES (N'0', ${qn(p.no)}, N'CL', N'${ym(p.d0)}', N'${MARK}', SYSDATETIME(), N'N')`)
    await req().query(`UPDATE dbo.plang SET ll_no2=${qn(p.no)}, asp_user2=N'${MARK}', asp_time2=SYSDATETIME()
      WHERE id=${r.id} AND ISNULL(asp_cancel,'N')<>'Y'`)
    if (++done % 100 === 0) console.log(`  ...已补 ${done}/${plan.length}`)
  }
  await tx.commit()
  console.log(`\n[完成] ${DB}:${done} 行补上领料单`)
} catch (e) {
  await tx.rollback()
  console.log('\n[失败并回滚] ' + e.message)
  process.exitCode = 1
}
await pool.close()
