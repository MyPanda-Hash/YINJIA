/**
 * 生成「90 张检验单按真实场景完善 + 审批归档」的迁移 SQL(2026-10-18)
 *
 * 【用户口径】
 *   「把 90 张单据全按真实场景进行一个完善,全部审批归档,人员随机,单据日期不入 10 月,
 *     其他的随机,明细数据也随机设计一下,11 张真实单据留着走流程,数据看板要对应上」
 *
 * 【对象识别】90 张 = `qc_insp` 里 `asp_time1`(创建日) = 2026-10-16 且「暂收单号」为空的行
 *   —— 那是 2026-10-16 一次性灌进去的演示数据,与「暂收单审核自动生成」的 11 张真实单要分开。
 *   11 张(有 SL-* 暂收单号) **一律不碰**,留给业务走流程。
 *
 * 【随机数据的来源】(不用编名字,全部取自库里真实档案)
 *   供应商 dm_gf(13 家) / 员工 bs_emp(122 人) / 原材料 bs_inv(39 条) / 部门 bs_dept / 单位 bs_uom
 *
 * 【映射】(字段取值域以 yj_field 为准,不造非法枚举值)
 *   单据日期  → 2026-09-01 ~ 09-30(用户要求:不入 10 月)
 *   供应商/业务员/部门/检验员 → 档案随机
 *   检验类型  → 全检 / 抽检 / 免检
 *   总结论    → 按该单明细的不良率判:0 不良=合格、<5%=让步接收、≥5%=不合格
 *   明细      → 每单 1~5 行,物料随机,送检 100~5000,不良率 0~8%(多数为 0),
 *               处置方式 入库 / 退货 / 让步入库(按有无不良)
 *   审批归档  → 单据状态=已审核 + 审核人/审核时间;yj_doc_status archived='Y' + archived_at;
 *               yj_form_approval 留一条 AUDIT/APPROVED 留痕(与 ButtonService.markArchived 同口径)
 *
 * 【看板对应】DashboardStatsService.quality 的 total/pass/bad 直接来自
 *   `SUM(qc_insp_detail.送检数量 / 合格数量 / 不合格数量)`,按 `qc_insp.单据日期` 区间过滤、不看单据状态
 *   ⇒ 本脚本只改这两个表的这两类列,看板数字自动一致,无需另写看板数据。
 *
 * 【幂等】以 `qc_insp.asp_user2 = 'qc-realize-20261018'` 为完成标记:已标记则整段跳过。
 *
 * 用法: node tools/archive/_qc-insp-realize-20261018/_gen-qc-realize.mjs
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..', '..')
const OUT = path.join(ROOT, 'tools', 'migrate-qc-insp-realize-20261018.sql')
const MARK = 'qc-realize-20261018'

/* 固定种子:每次重跑生成的"随机"数据完全一样,便于复核与回滚对照 */
let seed = 20261018
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true, loginTimeout: 10 },
})
const q = async (sql) => (await pool.request().query(sql)).recordset

const targets = await q(`
  SELECT 单据编号 FROM qc_insp
   WHERE CONVERT(varchar(10), asp_time1, 23) = '2026-10-16' AND ISNULL(暂收单号,'') = ''
     AND ISNULL(asp_cancel,'N') <> 'Y'
   ORDER BY 单据编号`)
const suppliers = await q(`SELECT dm AS code, mc AS name FROM dm_gf
  WHERE ISNULL(asp_cancel,'N')<>'Y' AND mc NOT LIKE N'%演示%' AND mc NOT LIKE N'%测试%'
  ORDER BY dm`)
const emps = await q(`SELECT 员工名称 AS name FROM bs_emp WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(员工名称,'')<>'' ORDER BY 员工编码`)
const depts = await q(`SELECT 部门编码 AS code, 部门名称 AS name FROM bs_dept WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 部门编码`)
const items = await q(`
  SELECT 存货编码 AS code, 存货名称 AS name, ISNULL(规格型号,'') AS spec, ISNULL(计量单位,'件') AS uom
    FROM bs_inv
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(所属类别,'') IN (N'原材料',N'辅助材料',N'包装物')
   ORDER BY 存货编码`)
await pool.close()

if (targets.length !== 90) {
  console.log(`[FAIL] 目标单据不是 90 张(实测 ${targets.length}),先核对口径`)
  process.exit(1)
}
if (!suppliers.length || !emps.length || !items.length || !depts.length) {
  console.log('[FAIL] 档案为空,无法造真实数据')
  process.exit(1)
}

/* ── 造数据 ── */
const N = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `N'${String(v).replace(/'/g, "''")}'`)
const upd = []   // 单头
const ins = []   // 明细
const docs = []  // 归档
let detailRows = 0

for (const t of targets) {
  const no = t['单据编号']
  const day = int(1, 30)
  const date = `2026-09-${String(day).padStart(2, '0')}`
  const sup = pick(suppliers)
  const emp = pick(emps).name
  const sales = pick(emps).name
  const dept = pick(depts)
  const itype = pick(['全检', '抽检', '免检'])
  const batch = 'PC' + date.replace(/-/g, '')

  const nLines = int(1, 5)
  let sentSum = 0, okSum = 0, ngSum = 0
  for (let i = 0; i < nLines; i++) {
    const it = pick(items)
    const sent = int(100, 5000)
    // 不良率:免检按口径恒 0;其余约一半零不良,余下 0.5%~8%(真实场景:免检单不该出不良)
    const rate = itype === '免检' ? 0 : (rnd() < 0.5 ? 0 : (rnd() * 0.075 + 0.005))
    const ng = Math.round(sent * rate)
    const ok = sent - ng
    const dispose = ng === 0 ? '入库' : (rate >= 0.05 ? '退货' : '让步入库')
    sentSum += sent; okSum += ok; ngSum += ng
    const price = (int(800, 20000) / 100).toFixed(2)
    ins.push(`(${N(no)},${N(it.code)},${N(it.name)},${N(it.spec)},${N(it.code + '-' + batch)},${sent},${ok},${ng},0,${price},${N(dispose)},${N(it.uom)},${N(date)},${N(batch)},${N(emp)},${N(MARK)})`)
    detailRows++
  }
  const badRate = sentSum > 0 ? ngSum / sentSum : 0
  const concl = ngSum === 0 ? '合格' : (badRate >= 0.05 ? '不合格' : '让步接收')
  // 审核时间 = 单据日期 + 1~3 天(仍在 9 月内,避免审核日跑到 10 月)
  const auditDay = Math.min(30, day + int(1, 3))
  const auditDate = `2026-09-${String(auditDay).padStart(2, '0')} ${String(int(9, 17)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')}:00`
  const auditor = emp
  upd.push(`(${N(no)},${N(date)},${N(sup.code)},${N(sup.name)},${N(sales)},${N(dept.code)},${N(dept.name)},${sentSum},${N(itype)},${N(concl)},${N(batch)},${N(auditor)},${N(auditDate)},${N(MARK)})`)
  docs.push(`(${N(no)},${N(auditor)},${N(auditDate)})`)
}

/* ── 生成 SQL ── */
const L = []
L.push('-- migrate-qc-insp-realize-20261018.sql — 90 张演示检验单按真实场景完善并审批归档(2026-10-18)')
L.push('--')
L.push('-- 【用户口径】「把90张单据全按真实场景进行一个完善,全部审批归档,人员随机,单据日期不入10月,')
L.push('--   其他的随机,明细数据也随机设计一下,11张真实单据留着走流程,数据看板要对应上」')
L.push('--')
L.push('-- 【对象】`qc_insp` 里 `asp_time1`(创建日)=2026-10-16 且「暂收单号」为空的 90 张 ——')
L.push('--   那是 2026-10-16 一次性灌进去的演示数据;有 SL-* 暂收单号的 11 张是暂收单审核自动生成的真实单,')
L.push('--   **本脚本一律不碰**,留给业务走流程。')
L.push('--')
L.push('-- 【随机数据全部取自库内真实档案】供应商 dm_gf(13)/员工 bs_emp(122)/原材料 bs_inv(39)/部门 bs_dept/单位 bs_uom;')
L.push('--   字段取值域以 yj_field 为准(检验类型 全检·抽检·免检 / 处置方式 入库·退货·让步入库 / 总结论 合格·不合格·让步接收)。')
L.push('--   固定随机种子生成,重跑结果一致,便于复核。')
L.push('--')
L.push('-- 【审批归档】与 ButtonService.markArchived 同口径:')
L.push('--   ① qc_insp 单据状态=已审核 + 审核人/审核时间(审核日 = 单据日期 +1~3 天,仍在 9 月内);')
L.push('--   ② yj_doc_status archived=\'Y\' + shr/shsj + archived_at(首次归档才写)+ saved=\'Y\';')
L.push('--   ③ yj_form_approval 留一条 AUDIT/APPROVED,「审批情况」里查得到。')
L.push('--')
L.push('-- 【看板对应】DashboardStatsService.quality 的 送检/合格/非合格 直接来自')
L.push('--   SUM(qc_insp_detail.送检数量/合格数量/不合格数量),按 qc_insp.单据日期 区间过滤、不看单据状态')
L.push('--   ⇒ 本脚本只改这两张表的业务列,看板数字自动一致。')
L.push('--')
L.push('-- 幂等:以 qc_insp.asp_user2 = \'' + MARK + '\' 为完成标记,已标记则整段跳过。两账套都要跑。')
L.push('')
L.push('SET NOCOUNT ON;')
L.push('')
L.push('/* ═══ 0. 幂等闸 ═══ */')
L.push(`IF EXISTS (SELECT 1 FROM qc_insp WHERE 单据编号 LIKE N'IJ-2026-10-%' AND ISNULL(asp_user2,'') = N'${MARK}')`)
L.push('BEGIN')
L.push("    PRINT N'  [SKIP] 这 90 张已经完善过(asp_user2 标记存在),不重复执行';")
L.push('    RETURN;')
L.push('END')
L.push('')
L.push('/* ═══ 1. 守卫:目标必须正好 90 张,且 11 张真实单(有暂收单号)不在其中 ═══ */')
L.push("DECLARE @targets int = (SELECT COUNT(1) FROM qc_insp WHERE CONVERT(varchar(10), asp_time1, 23) = '2026-10-16' AND ISNULL(暂收单号,'') = '' AND ISNULL(asp_cancel,'N') <> 'Y');")
L.push("IF @targets <> 90")
L.push('BEGIN')
L.push("    RAISERROR(N'[FAIL] 目标单据应为 90 张,实际 %d 张,先核对口径', 16, 1, @targets);")
L.push('    RETURN;')
L.push('END')
L.push("DECLARE @real int = (SELECT COUNT(1) FROM qc_insp WHERE ISNULL(暂收单号,'') <> '' AND ISNULL(asp_cancel,'N') <> 'Y');")
L.push("IF @real <> 11")
L.push('BEGIN')
L.push("    RAISERROR(N'[WARN] 有暂收单来源的真实单据不是 11 张(实际 %d),本脚本不动它们', 10, 1, @real);")
L.push('END')
L.push('')
L.push('/* ═══ 2. 清掉这 90 张的旧明细(演示态),随后按新单头重建 ═══ */')
L.push("DELETE d FROM qc_insp_detail d JOIN qc_insp h ON h.单据编号 = d.单据编号")
L.push(" WHERE CONVERT(varchar(10), h.asp_time1, 23) = '2026-10-16' AND ISNULL(h.暂收单号,'') = '';")
L.push('PRINT N\'  旧明细已清: \' + CAST(@@ROWCOUNT AS nvarchar(10)) + N\' 行\';')
L.push('')
L.push('/* ═══ 3. 单头:日期落 9 月 + 供应商/人员/部门/检验类型/总结论 全部随机 ═══ */')
L.push('DECLARE @h TABLE (no nvarchar(60) PRIMARY KEY, d nvarchar(30), sup_code nvarchar(60), sup_name nvarchar(200),')
L.push('                  sales nvarchar(100), dept_code nvarchar(60), dept_name nvarchar(100), qty decimal(18,4),')
L.push('                  itype nvarchar(20), concl nvarchar(20), batch nvarchar(60), auditor nvarchar(100), audit_at nvarchar(30), mark nvarchar(50));')
L.push('INSERT INTO @h (no,d,sup_code,sup_name,sales,dept_code,dept_name,qty,itype,concl,batch,auditor,audit_at,mark) VALUES')
L.push(upd.join(',\n') + ';')
L.push('')
L.push('UPDATE h SET 单据日期 = v.d, 供应商代码 = v.sup_code, 供应商 = v.sup_name, 业务员 = v.sales,')
L.push('             部门编码 = v.dept_code, 部门名称 = v.dept_name, 数量 = v.qty, 检验类型 = v.itype,')
L.push('             总结论 = v.concl, 批次号 = v.batch, 单据状态 = N\'已审核\', 审核人 = v.auditor,')
L.push('             审核时间 = v.audit_at, 审批人 = v.auditor, 审批时间 = v.audit_at,')
L.push('             检验日期 = v.d, asp_user2 = v.mark, asp_time2 = GETDATE()')
L.push('  FROM qc_insp h JOIN @h v ON h.单据编号 = v.no;')
L.push('PRINT N\'  单头已更新: \' + CAST(@@ROWCOUNT AS nvarchar(10)) + N\' 张\';')
L.push('')
L.push('/* ═══ 4. 明细:每单 1~5 行,物料/批号/数量/不良率/处置方式随机 ═══ */')
L.push('DECLARE @d TABLE (no nvarchar(60), code nvarchar(100), name nvarchar(200), spec nvarchar(200), lot nvarchar(60),')
L.push('                  sent decimal(18,4), ok decimal(18,4), ng decimal(18,4), scrap decimal(18,4), price decimal(18,4),')
L.push('                  dispose nvarchar(20), uom nvarchar(40), d nvarchar(30), batch nvarchar(60), inspector nvarchar(100), mark nvarchar(50));')
L.push('INSERT INTO @d (no,code,name,spec,lot,sent,ok,ng,scrap,price,dispose,uom,d,batch,inspector,mark) VALUES')
L.push(ins.join(',\n') + ';')
L.push('')
L.push('INSERT INTO qc_insp_detail (单据编号,物料编码,物料名称,规格型号,批号,送检数量,合格数量,不合格数量,报废数量,单价,处置方式,单位,日期,批次号,品质复核人,asp_user1)')
L.push("SELECT no, code, name, NULLIF(spec,N''), lot, sent, ok, ng, scrap, price, dispose, uom, d, batch, inspector, mark FROM @d;")
L.push('PRINT N\'  明细已重建: \' + CAST(@@ROWCOUNT AS nvarchar(10)) + N\' 行\';')
L.push('')
L.push('/* ═══ 5. 审批归档:yj_doc_status(archived=Y)+ yj_form_approval 留痕 ═══ */')
L.push('MERGE yj_doc_status AS t')
L.push('USING (SELECT h.单据编号 AS doc_no, h.审核人 AS shr, h.审核时间 AS shsj FROM qc_insp h')
L.push('        WHERE ISNULL(h.asp_user2,\'\') = N\'' + MARK + '\') AS s')
L.push('   ON t.panel_code = N\'QC_INSP\' AND t.doc_no = s.doc_no')
L.push("WHEN MATCHED THEN UPDATE SET shr = s.shr, shsj = CONVERT(datetime, s.shsj), canceled = 'N', pending = 'N',")
L.push("                             saved = 'Y', archived = 'Y',")
L.push('                             archived_at = CASE WHEN t.archived_at IS NULL THEN CONVERT(datetime, s.shsj) ELSE t.archived_at END,')
L.push('                             update_at = GETDATE()')
L.push("WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, shr, shsj, canceled, pending, saved, archived, archived_at, update_at)")
L.push("VALUES (N'QC_INSP', s.doc_no, s.shr, CONVERT(datetime, s.shsj), 'N', 'N', 'Y', 'Y', CONVERT(datetime, s.shsj), GETDATE());")
L.push('PRINT N\'  归档状态已写: \' + CAST(@@ROWCOUNT AS nvarchar(10)) + N\' 张\';')
L.push('')
L.push("INSERT INTO yj_form_approval (panel_code, form_no, action, result, node_no, operator, opinion, create_time)")
L.push('SELECT N\'QC_INSP\', h.单据编号, N\'AUDIT\', N\'APPROVED\', 1, h.审核人,')
L.push('       N\'来料检验完成,单证齐全,同意入库\', CONVERT(datetime, h.审核时间)')
L.push('  FROM qc_insp h')
L.push(" WHERE ISNULL(h.asp_user2,'') = N'" + MARK + "'")
L.push("   AND NOT EXISTS (SELECT 1 FROM yj_form_approval a WHERE a.panel_code = N'QC_INSP' AND a.form_no = h.单据编号 AND a.action = N'AUDIT');")
L.push('PRINT N\'  审批留痕已补: \' + CAST(@@ROWCOUNT AS nvarchar(10)) + N\' 条\';')
L.push('')
L.push('/* ═══ 6. 自检 ═══ */')
L.push("DECLARE @done int = (SELECT COUNT(1) FROM qc_insp WHERE ISNULL(asp_user2,'') = N'" + MARK + "' AND 单据状态 = N'已审核');")
L.push(`DECLARE @arch int = (SELECT COUNT(1) FROM yj_doc_status WHERE panel_code = N'QC_INSP' AND archived = 'Y' AND doc_no IN (SELECT 单据编号 FROM qc_insp WHERE ISNULL(asp_user2,'') = N'${MARK}'));`)
L.push("DECLARE @oct int = (SELECT COUNT(1) FROM qc_insp WHERE ISNULL(asp_user2,'') = N'" + MARK + "' AND 单据日期 >= '2026-10-01');")
L.push("DECLARE @real2 int = (SELECT COUNT(1) FROM qc_insp WHERE ISNULL(暂收单号,'') <> '' AND 单据状态 = N'草稿');")
L.push("PRINT N'  结果: 已审核 + 已标记 = ' + CAST(@done AS nvarchar(10)) + N' / 归档 = ' + CAST(@arch AS nvarchar(10))")
L.push("      + N' / 单据日期落进 10 月 = ' + CAST(@oct AS nvarchar(10)) + N' / 真实单仍为草稿 = ' + CAST(@real2 AS nvarchar(10));")
L.push('IF @done <> 90')
L.push('BEGIN')
L.push("    RAISERROR(N'[FAIL] 应为 90 张已审核,实际 %d', 16, 1, @done);")
L.push('    RETURN;')
L.push('END')
L.push('IF @arch <> 90')
L.push('BEGIN')
L.push("    RAISERROR(N'[FAIL] 应为 90 张已归档,实际 %d', 16, 1, @arch);")
L.push('    RETURN;')
L.push('END')
L.push('IF @oct > 0')
L.push('BEGIN')
L.push("    RAISERROR(N'[FAIL] 有 %d 张单据日期落进了 10 月', 16, 1, @oct);")
L.push('    RETURN;')
L.push('END')
L.push('IF @real2 <> 11')
L.push('BEGIN')
L.push("    RAISERROR(N'[FAIL] 真实单据应为 11 张草稿(留着走流程),实际 %d', 16, 1, @real2);")
L.push('    RETURN;')
L.push('END')
L.push(`PRINT N'[OK] 90 张检验单已按真实场景完善并审批归档;11 张真实单据保持草稿待走流程'`)

writeFileSync(OUT, L.join('\r\n') + '\r\n', 'utf8')
console.log(`已生成 ${OUT}(${L.length} 行)`)
console.log(`  单头 ${upd.length} 张 / 明细 ${detailRows} 行 / 归档 + 留痕 ${docs.length} 张`)
const conclCount = {}
for (const u of upd) { const m = u.match(/N'(合格|不合格|让步接收)'\),N'/); if (m) conclCount[m[1]] = (conclCount[m[1]] || 0) + 1 }
console.log('  总结论分布: ' + JSON.stringify(conclCount))
