/**
 * 来料检验单的「检验项目目录 + 检验数据记录」填写与审批(2026-10-14,正式库)
 *
 * 口径(用户):「包括来料检验目录,检验数据记录【检验项目随意】都要填写也要审批」。
 * 做法:**只读** SQL 取检验单明细(物料/送检数量),写入一律走平台 API:
 *   ① QC_INSP_REC 保存(表头 + items[检验项/检测标准/检测结果/单项判定]) → 取号 JYSJ-…
 *   ② QC_INSP_REC 提交审批 → 审批通过
 *   ③ QC_INSP_REQ 检验项目目录:保存(物料类别/物料编号/检验依据 + 若干特性标准值)
 *   ④ QC_INSP 提交审批 → 审批通过
 *
 * 用法: node tools/archive/_fill-qc-insp-1014.mjs [--base http://127.0.0.1:8090] [--db HSDZ_MES]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const BASE = arg('base', 'http://127.0.0.1:8090')
const DB = arg('db', 'HSDZ_MES')
const FACTORY = DB === 'HSDZ_MES' ? undefined : 'YJ_TEST'

const IJ = ['IJ-2026-10-0002', 'IJ-2026-10-0003', 'IJ-2026-10-0004', 'IJ-2026-10-0005',
  'IJ-2026-10-0006', 'IJ-2026-10-0007', 'IJ-2026-10-0008', 'IJ-2026-10-0009']

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const inList = IJ.map((x) => `'${x}'`).join(',')
const items = (await pool.request().query(
  `SELECT 单据编号, 物料编码, 物料名称, 计量单位, SUM(送检数量) AS 送检, MAX(批次号) AS 批号
   FROM qc_insp_detail WHERE 单据编号 IN (${inList}) GROUP BY 单据编号, 物料编码, 物料名称, 计量单位`)).recordset
const heads = (await pool.request().query(
  `SELECT 单据编号, ISNULL(供应商,N'') AS 供应商, ISNULL(检验员,N'') AS 检验员 FROM qc_insp WHERE 单据编号 IN (${inList})`)).recordset
// 上一轮已建好的检验数据记录(只有头、缺明细)⇒ 按备注里的检验单号找回,本轮**用同单号回填明细**
const recRows = (await pool.request().query(
  `SELECT 单据编号, 备注 FROM qc_insp_rec WHERE 备注 LIKE N'历史回填:按检验单%'`)).recordset
const existing = new Map()
for (const r of recRows) {
  const m = /IJ-[0-9-]+/.exec(String(r.备注 || ''))
  if (m && !existing.has(m[0])) existing.set(m[0], r.单据编号)
}
await pool.close()
const headOf = new Map(heads.map((h) => [h.单据编号, h]))
console.log(`检验单 ${IJ.length} 张 / 明细行 ${items.length} 条`)

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', ...(FACTORY ? { factory: FACTORY } : {}) }),
})).json()
if (!login?.data?.token) { console.log('❌ 登录失败:', JSON.stringify(login).slice(0, 160)); process.exit(1) }
const token = login.data.token
const post = async (u, b) => (await (await fetch(BASE + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(b || {}),
})).json())
/** ⚠ 明细必须放在请求体的 **`detail`** 兄弟字段里(ButtonService 从 body.detail 取 tabKey/items),
 *  放在 formData 里会被**静默忽略** —— 头能存、明细丢失(实测踩到)。 */
const btn = async (p, name, fd, detail) => post('/api/px/callButton', {
  panelCode: p, buttonName: name, formData: fd, ...(detail ? { detail } : {}), buttonParam: {},
})
const approve = async (p, no) => {
  const s = await btn(p, '提交审批', { 编号: no, 单据编号: no })
  const a = await btn(p, '审批通过', { 编号: no, 单据编号: no })
  return a.code === 0 ? '已审核' : `通过失败:${(a.message || '').slice(0, 50)}`
}

const done = []
for (const it of items) {
  const ij = it.单据编号
  const h = headOf.get(ij) || {}
  // ① 检验数据记录(表头 + 明细:检验项/检测标准/检测结果/单项判定)
  const fd = {
    单据日期: '2026-10-14', 物料编码: it.物料编码, 物料名称: it.物料名称,
    物料批次: it.批号 || '', 检验日期: '2026-10-14', 来料日期: '2026-10-14',
    来料数量: String(it.送检 ?? ''), 计量单位: it.计量单位 || '个',
    检验依据: 'GB/T 2828.1 抽样检验', 检验结论: '合格', 处理意见: '同意入库',
    检验人: h.检验员 || 'admin', 备注: `历史回填:按检验单 ${ij} 自动填写`,
    items: [
      { 检验项: '外观', 检测标准: '无破损、无脏污、无变形', 检测结果: '符合', 单项判定: '合格' },
      { 检验项: '尺寸', 检测标准: '按图纸公差 ±0.5mm', 检测结果: '符合', 单项判定: '合格' },
      { 检验项: '重量', 检测标准: '标称值 ±3%', 检测结果: '符合', 单项判定: '合格' },
    ],
  }
  const s = await btn('QC_INSP_REC', '保存', {
    ...fd,
    单据编号: existing.get(ij) || undefined,
    // ⚠ 明细键必须在 **formData 内**:ButtonService 是 `body.remove("detail")` 而 body = formData 副本
    //   (放 body 顶层会被 PxController 丢掉 —— 头能存、明细静默丢失,实测踩到两次)
    detail: {
      items: [
        { 检验项: '外观', 检测标准: '无破损、无脏污、无变形', 检测结果: '符合', 单项判定: '合格' },
        { 检验项: '尺寸', 检测标准: '按图纸公差 ±0.5mm', 检测结果: '符合', 单项判定: '合格' },
        { 检验项: '重量', 检测标准: '标称值 ±3%', 检测结果: '符合', 单项判定: '合格' },
      ],
    },
  })
  const recNo = (s.data && s.data['编号']) || existing.get(ij)
  const recState = recNo ? await approve('QC_INSP_REC', recNo) : `保存失败:${(s.message || '').slice(0, 50)}`

  // ③ 检验项目目录(按物料登记标准要求值;⚠ qc_insp_req 没有「备注」列,别传)
  const req = await btn('QC_INSP_REQ', '保存', {
    物料类别: '来料', 物料编号: it.物料编码, 文件编码: 'QR-QC-001', 检验依据: 'GB/T 2828.1',
    外径: '按图纸', 内径: '按图纸', 高度: '按图纸', 克重: '标称值±3%', 材质: '按图纸',
  })
  const reqNo = req.data && (req.data['编号'] || req.data['物料编号'])

  // ④ 检验单本身审批
  const ijState = await approve('QC_INSP', ij)

  done.push({ ij, 物料: it.物料编码, 记录单号: recNo || '', 记录状态: recState, 目录: reqNo ? 'ok' : `失败:${(req.message || '').slice(0, 40)}`, 检验单状态: ijState })
  console.log(`${ij} ${it.物料编码} → 记录 ${recNo} [${recState}] 目录[${reqNo ? 'ok' : 'fail'}] 检验单[${ijState}]`)
}

console.log('\n=== 汇总 ===')
for (const d of done) console.log(JSON.stringify(d))
