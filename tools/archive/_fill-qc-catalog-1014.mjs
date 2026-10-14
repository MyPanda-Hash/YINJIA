/**
 * 检验项目目录(QC_INSP_REQ)登记 —— 2026-10-14,正式库
 *
 * 🔴 关键:该面板是**基础档案式**(tabKey = 表名 `qc_insp_req`,不是单据的 `items`)
 *   ⇒ 行数组必须放在 `formData.detail.qc_insp_req`,每行自带业务键(物料类别 + 物料编号)+ 检验特性标准值。
 *   (前两轮按 `items`/顶层 detail 传,服务端**静默不落库**、返回照样 success —— 已实测踩到。)
 *
 * 用法: node tools/archive/_fill-qc-catalog-1014.mjs [--base http://127.0.0.1:8090]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const BASE = arg('base', 'http://127.0.0.1:8090')

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
// 8 张检验单对应的物料 + 名称(只读)
const mats = (await pool.request().query(
  `SELECT DISTINCT 物料编码, 物料名称 FROM qc_insp_detail WHERE 单据编号 LIKE 'IJ-2026-10-%' AND ISNULL(物料编码,N'') <> N''`)).recordset
// 既有目录里同编码的分类,优先沿用(保持口径一致)
const existing = (await pool.request().query(
  `SELECT 物料编号, 物料类别 FROM qc_insp_req WHERE ISNULL(物料类别,N'') <> N''`)).recordset
// 商品档案里的分类(bs_inv 无「存货分类」列,实测报 Invalid column name ⇒ 不查,分类只沿用既有目录口径)
const invCat = []
await pool.close()
const catOf = new Map(existing.map((r) => [r.物料编号, r.物料类别]))
const invCatOf = new Map(invCat.map((r) => [r.存货编码, r.分类]))
console.log(`检验单涉及物料 ${mats.length} 个`)

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login.data.token
const post = async (u, b) => (await (await fetch(BASE + u, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(b || {}),
})).json())

for (const m of mats) {
  const cat = catOf.get(m.物料编码) || invCatOf.get(m.物料编码) || '自定义检验要求'
  const row = {
    物料类别: cat, 物料编号: m.物料编码, 文件编码: 'QR-QC-001', 检验依据: 'GB/T 2828.1 抽样检验',
    外径: '按图纸', 内径: '按图纸', 高度: '按图纸', 克重: '标称值±3%', 材质: '按图纸',
    长: '按图纸', 宽: '按图纸', 厚度: '按图纸', 尺寸: '按图纸',
  }
  const r = await post('/api/px/callButton', {
    panelCode: 'QC_INSP_REQ', buttonName: '保存',
    formData: { detail: { qc_insp_req: [row] } },   // ★ 基础档案式:detail.<表名> = 行数组
    buttonParam: {},
  })
  console.log(`${m.物料编码}(${m.物料名称}) 类别=${cat} → code=${r.code} ${r.code === 200 ? 'ok' : (r.message || '').slice(0, 60)}`)
}
