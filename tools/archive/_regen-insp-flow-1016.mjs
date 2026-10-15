/**
 * 来料检验单流程「重新生成」(2026-10-16,正式库,只走平台 API)
 *
 * 用户口径:流程 = 采购订单 →(生单)→ 送料暂收单 →(审核)→ 生单 → 来料检验单 →(填检验目录/检验数据记录)→ 审批;
 *   批号 = **供应商代码 + 日期**(平台 BatchService 规则);检验单日期 = **采购订单单据日期**;
 *   列表最新日期在最上;审批后自动产生的采购入库单**要删掉**(与金蝶同步重复)。
 *
 * 目标订单 = 现有检验单挂靠的采购订单(批号形态不对的那批)∪ 商品档案「来料检验=是」的订单。
 * 默认只生成不清理;清理(+ 重生成)需显式 `--clean`。
 *
 * 用法: node tools/archive/_regen-insp-flow-1016.mjs [--dry] [--clean]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const FROM = arg('from', '2026-09-01')
const DRY = argv.includes('--dry')
const CLEAN = argv.includes('--clean')
const BASE = 'http://127.0.0.1:8090'

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const lit = (arr) => arr.map((x) => `N'${String(x).replace(/'/g, "''")}'`).join(',')

// 1) 目标订单(2026-10-16 用户口径:「按流转来,如果来料检验不为是的就不用」)
//    ⇒ **只取商品档案「来料检验=是」的采购订单**;不按"现有检验单"反推
const poB = (await q(`SELECT DISTINCT o.单据编号 AS po FROM bd_pu_order o JOIN bl_pu_order l ON l.单据编号 = o.单据编号 AND ISNULL(l.asp_cancel,'N') <> 'Y' JOIN bs_inv iv ON iv.存货编码 = l.物料编码 WHERE o.单据日期 >= '${FROM}' AND ISNULL(iv.来料检验,N'') = N'是'`)).map((r) => r.po)
const poList = [...new Set(poB)]
const pos = poList.length
  ? await q(`SELECT 单据编号 AS po, CONVERT(varchar(10), 单据日期, 120) AS poDate FROM bd_pu_order WHERE 单据编号 IN (${lit(poList)}) ORDER BY 单据日期, 单据编号`)
  : []
const slOld = poList.length
  ? await q(`SELECT 单据编号 AS no FROM sl_recv WHERE 采购订单号 IN (${lit(poList)}) AND ISNULL(asp_cancel,'N') <> 'Y'`)
  : []
const ijOld = slOld.length
  ? await q(`SELECT 单据编号 AS no FROM qc_insp WHERE 暂收单号 IN (${lit(slOld.map((x) => x.no))}) AND ISNULL(asp_cancel,'N') <> 'Y'`)
  : []
const recOld = ijOld.length
  ? await q(`SELECT 单据编号 AS no FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N') <> 'Y'
      AND 备注 LIKE N'%IJ-%' AND SUBSTRING(备注, CHARINDEX('IJ-', 备注), 16) IN (${lit(ijOld.map((x) => x.no))})`)
  : []
const piOld = await q(`SELECT 单据编号 AS no FROM bd_purchase_in WHERE 来源单据 = N'来料检验单' AND ISNULL(asp_cancel,'N') <> 'Y'`)
await pool.close()
console.log(`目标采购订单 ${pos.length} 张(口径:商品档案「来料检验=是」)`)
console.log(`待清理:暂收单 ${slOld.length} / 检验单 ${ijOld.length} / 检验记录 ${recOld.length} / 检验产生的入库单 ${piOld.length}`)
if (DRY) { pos.forEach((p) => console.log(`   ${p.po}  ${p.poDate}`)); process.exit(0) }

const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const token = login.data.token
const post = async (u, b) => (await (await fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(b || {}) })).json())
const btn = async (panel, name, fd) => post('/api/px/callButton', { panelCode: panel, buttonName: name, formData: fd, buttonParam: {} })
const ok = (r) => r.code === 200 || r.code === 0
const approve = async (p, no) => { await btn(p, '提交审批', { 编号: no, 单据编号: no }); return ok(await btn(p, '审批通过', { 编号: no, 单据编号: no })) }
const del = async (p, no) => { await btn(p, '弃审', { 编号: no, 单据编号: no }); return ok(await btn(p, '删除', { 编号: no, 单据编号: no })) }

const bak = []
if (CLEAN) {
  for (const [p, list] of [['QC_INSP', ijOld], ['QC_RECV', slOld], ['QC_INSP_REC', recOld], ['PURCHASE_IN', piOld]]) {
    for (const x of list) if (!(await del(p, x.no))) bak.push(`${p}\t${x.no}`)
  }
  console.log(`① 清理完成(失败 ${bak.length} 张)`)
} else console.log('① 跳过清理(未加 --clean)')

const log = []
let madeIj = 0, delPi = 0, fail = 0
for (const p of pos) {
  try {
    const r = await post('/api/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: p.po })
    const lines = ((r.data && r.data.lines) || []).filter((x) => Number(x['剩余数量']) > 0).map((x) => ({ lineKey: x._lineKey || x.lineKey, qty: x['剩余数量'] }))
    if (!lines.length) { fail++; log.push(`${p.po}\t${p.poDate}\t无可送行`); continue }
    const g = await post('/api/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: p.po, lines })
    const sl = g.data && g.data['编号']
    if (!sl) { fail++; log.push(`${p.po}\t${p.poDate}\t生暂收单失败:${(g.message || '').slice(0, 30)}`); continue }
    await approve('QC_RECV', sl)
    const gg = await btn('QC_RECV', '生成检验或入库单', { 编号: sl, 单据编号: sl })
    const list = (gg.data && gg.data['生成清单']) || []
    const ij = (list.find((x) => x['面板'] === 'QC_INSP') || {})['编号']
    const pi = (list.find((x) => x['面板'] === 'PURCHASE_IN') || {})['编号']
    if (pi && await del('PURCHASE_IN', pi)) delPi++
    if (!ij) { log.push(`${p.po}\t${p.poDate}\t暂收${sl}\t批号${(g.data || {})['批次号'] || ''}\t无检验单(免检)`); continue }
    await btn('QC_INSP', '保存', { 编号: ij, 单据编号: ij, 单据日期: p.poDate })
    await approve('QC_INSP', ij)
    const after = await btn('QC_INSP', '生成检验或入库单', { 编号: ij, 单据编号: ij })
    for (const x of ((after.data && after.data['生成清单']) || [])) if (x['面板'] === 'PURCHASE_IN' && await del('PURCHASE_IN', x['编号'])) delPi++
    madeIj++
    log.push(`${p.po}\t${p.poDate}\t${sl}\t${(g.data || {})['批次号'] || ''}\t${ij}`)
  } catch (e) { fail++; log.push(`${p.po}\t${p.poDate}\t异常:${String(e.message).slice(0, 40)}`) }
}

const pool2 = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const chk = (await pool2.request().query(`
  SELECT COUNT(*) AS 检验单, SUM(CASE WHEN ISNULL(i.批次号,N'') LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' THEN 1 ELSE 0 END) AS 供应商代码加日期,
         SUM(CASE WHEN CONVERT(varchar(10), i.单据日期, 120) = CONVERT(varchar(10), o.单据日期, 120) THEN 1 ELSE 0 END) AS 日期等于订单日期
  FROM qc_insp i LEFT JOIN sl_recv sl ON sl.单据编号 = i.暂收单号 LEFT JOIN bd_pu_order o ON o.单据编号 = sl.采购订单号
  WHERE ISNULL(i.asp_cancel,'N') <> 'Y'`)).recordset[0]
await pool2.close()
console.log(`② 生成检验单 ${madeIj} 张;删除检验产生的入库单 ${delPi} 张;失败/跳过 ${fail}`)
console.log(`③ 复核: ${JSON.stringify(chk)}`)
writeFileSync(new URL('./_dump-out/regen-insp-flow-1016.tsv', import.meta.url),
  '采购订单\t订单日期\t暂收单\t批号\t检验单\r\n' + log.join('\r\n') + '\r\n\r\n清理失败:\r\n' + bak.join('\r\n'), 'utf8')
console.log('[产物] tools/archive/_dump-out/regen-insp-flow-1016.tsv')
