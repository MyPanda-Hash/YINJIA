/**
 * _fix-insp-detail.mjs —— 修复首件/制程检验单的**明细行结构**(2026-10-18 返工)
 *
 * 【用户报障】
 *   「首件检验单表格都没数据」「制程肯定也都是这样」——
 *   上一版只按"检验项目"写了明细,缺了**报表矩阵的行键**,纸面上每个样品格都是 "/"。
 *
 * 【首件检验单的纸面模型】(前端 core/qc/firstInspCols.js + QcFirstInspSheet.vue,单一真源)
 *   明细是**长表**:一行 = 一个「行类型 × 样品序号 × 检验列」。
 *     · 标准行:行类型='标准'、样品序号='标准'、检验列=<列键>、检验项目=<列名>、项目分组=<分组>、标准=<标准值>
 *     · 样品行:行类型='样品'、样品序号='1#'..'8#'、检验列=<同一列键>、实测数值=<实测>、结果判断='合格'
 *   列键/列名/分组/单位取自 DEFAULT_TEST_ITEMS(与后端 FirstInspItems.DEFS 同源):
 *     表观及脱粉(炭棒表观状态/炭棒脱粉情况)、尺寸及重量(外径/内径/长度/重量)、
 *     强度(跌落/挤压强度)、浊度及压降(浊度NTU/压降kPa)
 *   ⚠ 前两列(表观/脱粉)是勾选式,只填 1#/2#(CHECK_SAMPLE_ROWS);其余列 1#..8# 全填。
 *
 * 【制程检验单的纸面模型】(QcProcInspSheet.vue,2026-10-17 第六轮改纵向表)
 *   一行一个检验项目:检验要求 | 检验方法 | 产线常规功能性结果 | 结果判断 —— **不再有标准/样品双行**。
 *   上一版把每项写成"标准行+实测行"两行,纸面上就是一半空行 ⇒ 一并改正。
 *
 * 【做法】按 单据编号 删掉明细,再按模板形状重铺;头/审核状态/单号一律不动。
 * 用法(cd tools):
 *   node archive/_wo-flow-20261018/_fix-insp-detail.mjs --db HSDZ_MES [--apply|--verify]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n)
  if (i < 0) return d
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const DB = String(arg('db', 'HSDZ_MES'))
const APPLY = process.argv.includes('--apply')
const VERIFY = process.argv.includes('--verify')
const MARK = 'wo-insp-20261018'

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true, useUTC: false },
})
const q = async (s) => (await pool.request().query(s)).recordset
const qn = (s) => `N'${String(s == null ? '' : s).replace(/'/g, "''")}'`

/* ── 首件:10 列 × (1 标准 + 8 样品) ── */
const FIRST_ITEMS = [
  { key: 'appearance', label: '炭棒表观状态', group: '表观及脱粉', standard: '/', check: true },
  { key: 'depowder', label: '炭棒脱粉情况', group: '表观及脱粉', standard: '/', check: true },
  { key: 'outer', label: '炭棒外径', group: '尺寸及重量', standard: '按规格型号，公差 ±0.5mm', base: 34.2, step: 0.05, digits: 2 },
  { key: 'inner', label: '炭棒内径', group: '尺寸及重量', standard: '按规格型号，公差 ±0.5mm', base: 12.6, step: 0.02, digits: 2 },
  { key: 'length', label: '炭棒长度', group: '尺寸及重量', standard: '按规格型号，公差 ±0.5mm', base: 108.5, step: 0.1, digits: 1 },
  { key: 'weight', label: '炭棒重量(g)', group: '尺寸及重量', standard: '按产品标准', base: 47.8, step: 0.05, digits: 2 },
  { key: 'drop', label: '跌落', group: '强度', standard: '50cm 自由跌落 3 次无断裂', text: '合格' },
  { key: 'compress', label: '挤压强度', group: '强度', standard: '≥30kgf', base: 38.5, step: 0.2, digits: 1 },
  { key: 'turbidity', label: '浊度NTU', group: '浊度及压降', standard: '/', base: 0.8, step: 0.05, digits: 2 },
  { key: 'pressure', label: '压降kPa', group: '浊度及压降', standard: '≤20kpa', base: 8.2, step: 0.1, digits: 1 },
]
const CHECK_SAMPLES = [1, 2]

/* ── 制程:一行一项(纵向表) ── */
const PROC_ITEMS = [
  { 项目: '外观', 要求: '无破损、无裂纹、无脏污', 方法: '目视全检' },
  { 项目: '尺寸-外径', 要求: '按规格型号，公差 ±0.5mm', 方法: '游标卡尺测量' },
  { 项目: '尺寸-长度', 要求: '按规格型号，公差 ±0.5mm', 方法: '游标卡尺测量' },
  { 项目: '重量', 要求: '按产品标准', 方法: '电子秤称量' },
  { 项目: '成型压力', 要求: '按成型工艺参数', 方法: '设备仪表读取' },
  { 项目: '成型温度', 要求: '按成型工艺参数', 方法: '设备仪表读取' },
]

const firstDocs = await q(`SELECT [单据编号] AS no FROM dbo.qc_first_insp_head WHERE asp_user1=N'${MARK}' ORDER BY [单据编号]`)
const procDocs = await q(`SELECT [单据编号] AS no FROM dbo.qc_proc_insp_head WHERE asp_user1=N'${MARK}' ORDER BY [单据编号]`)

if (VERIFY) {
  const s = (await q(`
    SELECT (SELECT COUNT(*) FROM dbo.qc_first_insp_head WHERE asp_user1=N'${MARK}') AS 首件单,
      (SELECT COUNT(*) FROM dbo.qc_first_insp_detail d JOIN dbo.qc_first_insp_head h ON h.[单据编号]=d.[单据编号]
         WHERE h.asp_user1=N'${MARK}' AND d.[行类型]=N'样品' AND ISNULL(d.[样品序号],N'')<>N'') AS 首件样品行,
      (SELECT COUNT(*) FROM dbo.qc_proc_insp_head WHERE asp_user1=N'${MARK}') AS 制程单,
      (SELECT COUNT(*) FROM dbo.qc_proc_insp_detail d JOIN dbo.qc_proc_insp_head h ON h.[单据编号]=d.[单据编号]
         WHERE h.asp_user1=N'${MARK}') AS 制程明细行`))[0]
  console.log(`== ${DB} 检验明细结构体检 ==`)
  console.log(`  首件单 ${s.首件单} 张 / 带样品序号的样品行 ${s.首件样品行}(应为 首件单×70)`)
  console.log(`  制程单 ${s.制程单} 张 / 明细行 ${s.制程明细行}(应为 制程单×6)`)
  const sample = (await q(`SELECT TOP 6 d.[行类型], d.[样品序号], d.[检验列], d.[检验项目], d.[项目分组], d.[标准], d.[实测数值], d.[结果判断]
    FROM dbo.qc_first_insp_detail d JOIN dbo.qc_first_insp_head h ON h.[单据编号]=d.[单据编号]
    WHERE h.asp_user1=N'${MARK}' ORDER BY h.[单据编号], d.[行号]`))
  for (const r of sample) console.log(`    ${r.行类型}/${r.样品序号 ?? ''} 列=${r.检验列} 项=${r.检验项目} 组=${r.项目分组} 标准=${r.标准 ?? ''} 实测=${r.实测数值 ?? ''} 判定=${r.结果判断 ?? ''}`)
  await pool.close()
  process.exit(0)
}

console.log(`== ${DB} 检验明细结构重建 ==`)
console.log(`  首件 ${firstDocs.length} 张 → 每张 ${FIRST_ITEMS.length} 列 × (1 标准 + 8 样品)`)
console.log(`  制程 ${procDocs.length} 张 → 每张 ${PROC_ITEMS.length} 行(纵向表)`)
if (!APPLY) { console.log('\n[预演结束] 加 --apply 才落库'); await pool.close(); process.exit(0) }

const tx = new mssql.Transaction(pool)
await tx.begin()
const req = () => new mssql.Request(tx)
try {
  /* ① 首件明细 */
  let done = 0
  for (const d of firstDocs) {
    await req().query(`DELETE FROM dbo.qc_first_insp_detail WHERE [单据编号]=${qn(d.no)}`)
    let no = 0
    const rows = []
    for (const it of FIRST_ITEMS) {
      no++
      rows.push(`(${qn(d.no)}, N'首件检验', ${no}, ${qn(it.key)}, ${qn(it.label)}, ${qn(it.group)}, N'标准', N'标准',
        ${qn(it.standard)}, NULL, NULL, NULL, N'${MARK}', SYSDATETIME(), N'N')`)
      for (let s = 1; s <= 8; s++) {
        no++
        let val = null
        if (it.check) val = CHECK_SAMPLES.includes(s) ? '√' : null
        else if (it.text) val = it.text
        else val = (it.base + (s - 1) * it.step).toFixed(it.digits)
        rows.push(`(${qn(d.no)}, N'首件检验', ${no}, ${qn(it.key)}, ${qn(it.label)}, ${qn(it.group)}, N'样品', '${s}#',
          NULL, ${val == null ? 'NULL' : qn(val)}, ${val == null ? 'NULL' : qn('合格')}, ${val == null ? 'NULL' : 1}, N'${MARK}', SYSDATETIME(), N'N')`)
      }
    }
    /* 分批写(每 30 行一条 INSERT),避免单条语句过长 */
    for (let i = 0; i < rows.length; i += 30) {
      await req().query(`INSERT INTO dbo.qc_first_insp_detail
        ([单据编号], [表区], [行号], [检验列], [检验项目], [项目分组], [行类型], [样品序号], [标准], [实测数值], [结果判断], [数量], asp_user1, asp_time1, asp_cancel)
        VALUES ${rows.slice(i, i + 30).join(',')}`)
    }
    if (++done % 100 === 0) console.log(`  ...首件 ${done}/${firstDocs.length}`)
  }
  console.log(`  [首件] ${done} 张完成`)

  /* ② 制程明细(纵向表:一行一项) */
  done = 0
  for (const d of procDocs) {
    await req().query(`DELETE FROM dbo.qc_proc_insp_detail WHERE [单据编号]=${qn(d.no)}`)
    const rows = PROC_ITEMS.map((it, i) => `(${qn(d.no)}, N'制程检验', ${i + 1}, ${qn(it.项目)}, ${qn(it.要求)}, ${qn(it.方法)},
      1, ${qn('符合')}, N'合格', N'合格', 0, N'每2小时', N'${MARK}', SYSDATETIME(), N'N')`)
    await req().query(`INSERT INTO dbo.qc_proc_insp_detail
      ([单据编号], [表区], [行号], [检验项目], [检验要求], [检验方法], [抽检量], [产线常规功能性结果], [结果判断], [单项判定], [不良数量], [检查频率], asp_user1, asp_time1, asp_cancel)
      VALUES ${rows.join(',')}`)
    if (++done % 100 === 0) console.log(`  ...制程 ${done}/${procDocs.length}`)
  }
  console.log(`  [制程] ${done} 张完成`)
  await tx.commit()
  console.log(`\n[完成] ${DB}:首件 ${firstDocs.length} 张 / 制程 ${procDocs.length} 张明细已按纸面结构重建`)
} catch (e) {
  await tx.rollback()
  console.log('\n[失败并回滚] ' + e.message)
  process.exitCode = 1
}
await pool.close()
