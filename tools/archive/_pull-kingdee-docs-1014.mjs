/**
 * 金蝶 → MES 单据拉取(2026-10-14):把**真实账套**指定区间(默认 2026-09-01 至今)的 8 类单据拉进 MES。
 *
 * 覆盖:采购订单 / 销售订单 / 采购入库单 / 销售出库单 / 生产领料单(材料出库) /
 *       产品入库单(成品入库) / 其他入库单 / 其他出库单(均含明细行)
 *
 * 铁律与口径(全部实测得出,别凭印象改):
 *   1. 🔴 只读金蝶(全部 GET)。写的是 MES 库,目标账套由 --db 指定(默认测试账套)。
 *   2. **时间过滤**:金蝶列表接口只认 `create_start_time/create_end_time` 与 `modify_start_time/modify_end_time`
 *      (毫秒时间戳);`bill_date_start/end`、`date_start/end` 会被**静默忽略**(实测:count 与全量一模一样)。
 *      且 **inv_pick / inv_product 连 create_* 都不认**(实测 count 仍 = 全量)⇒ 这两个类型只能用 modify_*。
 *      因此本脚本按各自支持的键过滤(**modify 是 create 的超集**),再在本地按 **单据日期 >= from** 精筛。
 *   3. **幂等**:按「外部数据ID」(有该列的表)或「单据编号」判重 —— 先删该单的明细与头,再整单重插。
 *   4. 落库人 asp_user1 = '试运行',单据状态按金蝶 bill_status(C=已审核)写;
 *      拉取自金蝶的单据天然已在金蝶 ⇒ 是否已转ERP='是'、ERP单号=金蝶单号(与既有同步口径一致)。
 *   5. 数量/金额等一律按 MES 列型写入;金蝶空值落 NULL(不臆造)。
 *
 * 用法(仓库根):
 *   node tools/archive/_pull-kingdee-docs-1014.mjs                        # 测试账套,9/1 至今,8 类全拉
 *   node tools/archive/_pull-kingdee-docs-1014.mjs --db HSDZ_MES         # 落正式账套
 *   node tools/archive/_pull-kingdee-docs-1014.mjs --types pur_order,sal_order --limit 5   # 试跑
 * 产物: tools/archive/_dump-out/kingdee-pull-<tag>-1014.md(逐类型条数与错误)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import mssql from '../../deploy/node_modules/mssql/index.js'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const argv = process.argv.slice(2)
const arg = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt }
const DB = arg('db', 'HSDZ_MES_TEST')
const FROM = arg('from', '2026-09-01')
const TO = arg('to', new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10))  // 本机本地日期(UTC 口径会在 早上把"今天"算成昨天)
const LIMIT = Number(arg('limit', '0')) || 0
const ONLY = arg('types', '') ? arg('types').split(',') : null
const TAG = DB === 'HSDZ_MES' ? 'prod' : 'test'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const S = (v) => (v === undefined || v === null ? null : String(v))
const N = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? null : Number(v))
const D = (v) => (v ? String(v).slice(0, 10) : null)

const fromMs = String(new Date(FROM + 'T00:00:00+08:00').getTime())
const toMs = String(new Date(TO + 'T23:59:59+08:00').getTime())

// ─────────────────────────────────────────────────────────────
// 各类型:接口 / 目标表 / 时间过滤键 / 头行映射(金蝶键 → MES 列)
// 映射口径 = 金蝶键有数据(见 _dump-out/kingdee-3docs*-fieldfill-1014.md)+ MES 表确有该列(已逐一核对列名)
// ─────────────────────────────────────────────────────────────
const TYPES = [
  {
    kd: 'pur_order', kdName: '采购订单', panel: 'PU_ORDER', head: 'bd_pu_order', line: 'bl_pu_order',
    detail: '/jdy/v2/scm/pur_order_detail', timeKey: 'create', keyCol: '外部数据ID',
    headMap: [['bill_no', '单据编号'], ['bill_no', '外部单据号'], ['id', '外部数据ID'], ['bill_date', '单据日期'],
      ['supplier_number', '供应商编码'], ['supplier_name', '供应商'], ['emp_name', '业务员名称'], ['emp_number', '业务员编码'],
      ['dept_name', '部门名称'], ['dept_number', '部门编码'], ['remark', '备注'], ['delivery_type_name', '交货方式'],
      ['creator_name', '创建人名称'], ['create_time', '创建时间'], ['modifier_name', '修改人名称'], ['modify_time', '修改时间'],
      ['auditor_name', '审核人'], ['audit_time', '审核时间'], ['bill_close_state', '关闭状态'], ['io_status', '入库状态Z部分入库，C全部入库，A未入库']],
    lineMap: [['seq', '行号'], ['material_number', '物料编码'], ['material_name', '物料名称'], ['material_model', '规格型号'],
      ['unit_name', '单位'], ['qty', '数量'], ['price', '单价'], ['amount', '金额'], ['cess', '税率%'], ['tax_price', '含税单价'],
      ['all_amount', '含税金额'], ['inv_qty', '现存量'], ['comment', '备注'], ['delivery_date', '预计到货日期'],
      ['stock_number', '仓库编码'], ['stock_name', '仓库']],
  },
  {
    kd: 'sal_order', kdName: '销售订单', panel: 'SO_ORDER', head: 'bd_so_order', line: 'bl_so_order',
    detail: '/jdy/v2/scm/sal_order_detail', timeKey: 'create', keyCol: '外部数据ID',
    headMap: [['bill_no', '单据编号'], ['bill_no', '外部单据号'], ['id', '外部数据ID'], ['bill_date', '单据日期'],
      ['customer_number', '客户编码'], ['customer_name', '客户'], ['settle_customer_number', '结算客户'],
      ['dept_name', '部门'], ['emp_name', '业务员'], ['remark', '备注'], ['contact_linkman', '联系人'],
      ['total_amount', '应收金额'], ['create_time', '创建时间'], ['modify_time', '修改时间'],
      ['auditor_name', '审核人'], ['audit_time', '审核时间'], ['io_status', '出入库状态'], ['bill_close_state', '单据关闭状态']],
    lineMap: [['seq', '行号'], ['material_number', '存货编码'], ['material_name', '存货名称'], ['material_model', '规格型号'],
      ['unit_name', '销售单位'], ['qty', '数量'], ['price', '单价'], ['cess', '税率%'], ['tax_price', '含税单价'],
      ['amount', '金额'], ['all_amount', '含税金额'], ['dis_amount', '折扣金额'], ['delivery_date', '预计交货日期'],
      ['inv_qty', '现存量'], ['comment', '备注']],
  },
  {
    kd: 'pur_inbound', kdName: '采购入库单', panel: 'PURCHASE_IN', head: 'bd_purchase_in', line: 'bl_purchase_in',
    detail: '/jdy/v2/scm/pur_inbound_detail', timeKey: 'create', keyCol: '单据编号',
    headMap: [['bill_no', '单据编号'], ['bill_no', '外部单据号'], ['bill_date', '单据日期'],
      ['supplier_number', '供应商编码'], ['supplier_name', '供应商'], ['emp_name', '经手人'], ['emp_number', '经手人编码'],
      ['dept_name', '部门'], ['dept_number', '部门编码'], ['remark', '备注'], ['delivery_type_name', '交货方式'],
      ['creator_name', '创建人'], ['create_time', '创建时间'], ['modifier_name', '修改人'], ['modify_time', '修改时间'],
      ['auditor_name', '审核人'], ['audit_time', '审核时间'], ['bill_close_state', '单据关闭状态'], ['trans_type_name', '业务类型']],
    lineMap: [['seq', '行号'], ['material_number', '存货编码'], ['material_name', '存货名称'], ['material_model', '规格型号'],
      ['stock_name', '仓库'], ['stock_number', '仓库编码'], ['batch_no', '批号'], ['unit_name', '计量单位'],
      ['base_unit_name', '基本单位名称'], ['base_unit_number', '基本单位编码'], ['base_unit_id', '基本单位id'],
      ['aux_unit_number', '辅助单位编码'], ['aux_unit_id', '辅助单位id'],
      ['conversion_rate', '换算率_conversion_rate'], ['coefficient', '换算系数'], ['qty', '实收数量'], ['price', '单价'],
      ['amount', '金额'], ['tax_price', '含税单价'], ['all_amount', '含税金额'], ['cess', '税率%'], ['inv_qty', '现存量'],
      ['comment', '备注']],
  },
  {
    kd: 'sal_out_bound', kdName: '销售出库单', panel: 'SALE_OUT', head: 'bd_sale_out', line: 'bl_sale_out',
    detail: '/jdy/v2/scm/sal_out_bound_detail', timeKey: 'create', keyCol: '单据编号',
    headMap: [['bill_no', '单据编号'], ['bill_no', '外部单据号'], ['bill_date', '单据日期'],
      ['customer_number', '客户编码'], ['customer_name', '客户'], ['emp_name', '经手人'], ['emp_number', '经手人编码'],
      ['dept_name', '部门'], ['dept_number', '部门编码'], ['remark', '备注'], ['trans_type_name', '业务类型'],
      ['creator_name', '创建人'], ['create_time', '创建时间'], ['modifier_name', '修改人'], ['modify_time', '修改时间'],
      ['auditor_name', '审核人'], ['audit_time', '审核时间'], ['total_amount', '金额'], ['delivery_type_name', '交货方式']],
    lineMap: [['seq', '行号'], ['material_number', '存货编码'], ['material_name', '存货名称'], ['material_model', '规格型号'],
      ['stock_name', '仓库'], ['stock_number', '仓库编码'], ['batch_no', '批号'], ['unit_name', '计量单位'],
      ['base_unit_name', '基本单位名称'], ['base_unit_number', '基本单位编码'], ['base_unit_id', '基本单位id'],
      ['aux_unit_id', '辅助单位id'], ['aux_unit_number', '辅助单位编码'], ['coefficient', '换算系数'],
      ['qty', '数量'], ['price', '售价'], ['amount', '销售金额'], ['cess', '税率%'], ['tax_price', '含税售价'],
      ['all_amount', '含税销售金额'], ['dis_amount', '折扣金额'], ['inv_qty', '现存量'], ['comment', '备注']],
  },
  {
    kd: 'inv_pick', kdName: '生产领料单', panel: 'MATERIAL_OUT', head: 'bd_material_out', line: 'bl_material_out',
    detail: '/jdy/v2/scm/inv_pick_detail', timeKey: 'modify', keyCol: '单据编号',
    headMap: [['bill_no', '单据编号'], ['bill_date', '单据日期'], ['dept_name', '生产车间'], ['dept_number', '部门编码'],
      ['emp_name', '领用人'], ['emp_number', '经手人编码'], ['pick_type', '领料类型'], ['remark', '备注'],
      ['bill_type_name', '单据类型名称'], ['bill_type_number', '单据类型编码'], ['bill_type_id', '单据类型id'],
      ['creator_name', '创建人'], ['create_time', '创建时间'], ['modifier_name', '修改人'], ['modify_time', '修改时间'],
      ['auditor_name', '金蝶审核人'], ['audit_time', '金蝶审核时间']],
    lineMap: [['seq', '行号'], ['material_number', '材料编码'], ['material_name', '材料名称'], ['material_model', '规格型号'],
      ['stock_name', '仓库'], ['stock_number', '仓库编码'], ['batch_no', '批号'], ['unit_name', '计量单位'],
      ['base_unit_name', '基本单位名称'], ['base_unit_number', '基本单位编码'], ['base_unit_id', '基本单位id'],
      ['aux_unit_number', '辅助单位编码'], ['aux_unit_id', '辅助单位id'],
      ['conversion_rate', '换算率'], ['coefficient', '换算系数'], ['qty', '数量'], ['price', '单价'], ['amount', '金额'],
      ['inv_qty', '库存数量'], ['comment', '明细备注']],
  },
  {
    kd: 'inv_product', kdName: '产品入库单', panel: 'FINISH_IN', head: 'bd_finish_in', line: 'bl_finish_in',
    detail: '/jdy/v2/scm/inv_product_detail', timeKey: 'modify', keyCol: '单据编号',
    headMap: [['bill_no', '单据编号'], ['bill_no', '外部单据号'], ['id', '外部数据ID'], ['bill_date', '单据日期'],
      ['bill_type_name', '单据类型'], ['bill_type_name', '业务类型'], ['dept_name', '部门'], ['dept_number', '部门编码'],
      ['emp_name', '经手人'], ['emp_number', '经手人编码'], ['creator_name', '创建人'], ['create_time', '创建时间'],
      ['modifier_name', '修改人'], ['modify_time', '修改时间'], ['auditor_name', '审核人'], ['audit_time', '审核时间']],
    lineMap: [['seq', '序号'], ['material_number', '产品编码'], ['material_name', '产品名称'], ['material_model', '规格型号'],
      ['stock_name', '仓库'], ['batch_no', '批号'], ['unit_name', '计量单位'], ['base_unit_name', '基本单位名称'],
      ['base_unit_number', '基本单位编码'], ['base_unit_id', '基本单位id'],
      ['aux_unit_number', '辅助单位编码'], ['aux_unit_id', '辅助单位id'], ['conversion_rate', '换算率'],
      ['coefficient', '换算系数'], ['aux_coefficient', '辅助换算系数'], ['qty', '实收数量'], ['inv_qty', '库存数量'],
      ['picture', '存货图片'], ['comment', '备注']],
  },
  {
    kd: 'inv_other_in', kdName: '其他入库单', panel: 'OTHER_IN', head: 'bd_other_in', line: 'bl_other_in',
    detail: '/jdy/v2/scm/inv_other_in_detail', timeKey: 'create', keyCol: '外部数据ID',
    headMap: [['bill_no', '单据编号'], ['bill_no', '外部单据号'], ['id', '外部数据ID'], ['bill_date', '单据日期'],
      ['trans_type_name', '业务类型'], ['trans_type_number', '业务类型编码'], ['trans_type_id', '业务类型id'],
      ['supplier_number', '供应商编码'], ['supplier_name', '供应商'], ['dept_name', '部门'], ['dept_number', '部门编码'],
      ['emp_name', '经手人'], ['emp_number', '经手人编码'], ['creator_name', '创建人'], ['create_time', '创建时间'],
      ['modifier_name', '修改人'], ['modify_time', '修改时间'], ['auditor_name', '审核人'], ['audit_time', '审核时间'], ['remark', '备注']],
    lineMap: [['seq', '序号'], ['material_number', '存货编码'], ['material_name', '存货名称'], ['material_model', '规格型号'],
      ['stock_name', '仓库'], ['stock_number', '仓库编码'], ['unit_name', '计量单位'], ['base_unit_name', '基本单位名称'],
      ['base_unit_number', '基本单位编码'], ['base_unit_id', '基本单位id'],
      ['aux_unit_number', '辅助单位编码'], ['aux_unit_id', '辅助单位id'], ['conversion_rate', '换算率'],
      ['coefficient', '换算系数'], ['aux_coefficient', '辅助换算系数'], ['qty', '数量'], ['aux_qty', '辅助数量'],
      ['inv_qty', '库存数量'], ['cost', '成本'], ['unit_cost', '单位成本'], ['picture', '存货图片']],
  },
  {
    kd: 'inv_other_out', kdName: '其他出库单', panel: 'OTHER_OUT', head: 'bd_other_out', line: 'bl_other_out',
    detail: '/jdy/v2/scm/inv_other_out_detail', timeKey: 'create', keyCol: '外部数据ID',
    headMap: [['bill_no', '单据编号'], ['bill_no', '外部单据号'], ['id', '外部数据ID'], ['bill_date', '单据日期'],
      ['trans_type_name', '业务类型'], ['trans_type_number', '业务类型编码'], ['trans_type_id', '业务类型id'],
      ['dept_name', '部门'], ['dept_number', '部门编码'], ['emp_name', '经手人'], ['emp_number', '经手人编码'],
      ['creator_name', '创建人'], ['create_time', '创建时间'], ['modifier_name', '修改人'], ['modify_time', '修改时间'],
      ['auditor_name', '审核人'], ['audit_time', '审核时间'], ['remark', '备注']],
    lineMap: [['seq', '序号'], ['material_number', '存货编码'], ['material_name', '存货名称'], ['material_model', '规格型号'],
      ['stock_name', '仓库'], ['stock_number', '仓库编码'], ['batch_no', '批号'], ['unit_name', '计量单位'],
      ['base_unit_name', '基本单位名称'], ['base_unit_number', '基本单位编码'], ['base_unit_id', '基本单位id'],
      ['aux_unit_number', '辅助单位编码'], ['aux_unit_id', '辅助单位id'],
      ['conversion_rate', '换算率'], ['coefficient', '换算系数'], ['aux_coefficient', '辅助换算系数'],
      ['qty', '数量'], ['aux_qty', '辅助数量'], ['inv_qty', '库存数量']],
  },
]

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
/** 取表的列名 + 列型:列型用来决定「值按数值还是字符串写」——
 *  ⚠ 不能用 /^\d+$/ 猜:金蝶的 **id 类字段是 19 位长数字串**(如 base_unit_id=2167741887128111104),
 *    当数值转会超 JS 安全整数、mssql 直接报「Value must be between ±9007199254740991」(实测踩到)。 */
const colsOf = async (t) => (await pool.request().query(
  `SELECT c.name, ty.name AS typ, c.max_length FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.${t}')`)).recordset
/** 必填列(NOT NULL、非自增、无默认值):这些列金蝶不给值时脚本必须兜底,否则该单必然插不进去 */
const reqColsOf = async (t) => (await pool.request().query(
  `SELECT c.name FROM sys.columns c LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id WHERE c.object_id = OBJECT_ID('dbo.${t}') AND c.is_nullable = 0 AND c.is_identity = 0 AND dc.object_id IS NULL`)).recordset.map((r) => r.name)
const NUMERIC = new Set(['decimal', 'numeric', 'int', 'bigint', 'smallint', 'tinyint', 'float', 'real', 'money', 'smallmoney', 'bit'])
let truncated = 0
/** 按目标列型/列宽落值。字符串超宽**截断并计数** —— 否则一条超长值会让**整单**失败
 *  (实测:金蝶 picture 297~303 字符 vs 列 nvarchar(200) → String or binary data would be truncated)。 */
const toVal = (raw, typ, maxLen) => {
  if (NUMERIC.has(typ)) return N(raw)
  let s = S(raw)
  const limit = maxLen > 0 ? Math.floor(maxLen / 2) : 0   // nvarchar/nchar:字节数 ÷ 2
  if (s && limit > 0 && s.length > limit) { s = s.slice(0, limit); truncated++ }
  return s
}

const report = []
const say = (s) => { report.push(s); console.log(s) }
say(`# 金蝶 → MES 拉取(目标库 ${DB};区间 ${FROM} ~ ${TO})`)
say('')
say(`- 金蝶账套:惠州市银嘉环保(只读)   落库人:试运行   时间:${new Date().toISOString()}`)
say('')
say('| 单据 | 金蝶区间内(按单据日期) | 拉取成功 | 明细行 | 失败 | 备注 |')
say('|---|---|---|---|---|---|')

let grandOk = 0, grandLine = 0, grandFail = 0
for (const t of TYPES) {
  if (ONLY && !ONLY.includes(t.kd)) continue
  const headRows = await colsOf(t.head), lineRows = await colsOf(t.line)
  const headCols = new Map(headRows.map((x) => [x.name, x.typ])), lineCols = new Map(lineRows.map((x) => [x.name, x.typ]))
  // 映射裁剪:目标表没有的列直接跳过(并记录,便于发现映射写错)
  const hMap = t.headMap.filter(([, c]) => headCols.has(c))
  const lMap = t.lineMap.filter(([, c]) => lineCols.has(c))
  const missing = [...t.headMap, ...t.lineMap].filter(([, c]) => !headCols.has(c) && !lineCols.has(c)).map(([, c]) => c)
  if (missing.length) say(`- ⚠ ${t.kdName}:映射里有目标表不存在的列,已跳过 —— ${[...new Set(missing)].join(', ')}`)

  // 必填列预检(2026-10-16):NOT NULL/非自增/无默认 的列若既不在映射目标、也不在兜底名单里 ⇒ 提前报出来。
  // 不预检的话表现是「逐单静默失败」(本次实测:采购订单 187/187 全挂在 币种 上,日志只看得见前 3 条)。
  {
    const FIXED = ['单据编号', '单据状态', '是否已转ERP', 'ERP单号', '转ERP操作人', '转ERP时间', 'asp_user1', 'asp_time1', 'asp_cancel']
    const FILLABLE = ['币种', '汇率', '业务类型', '结算客户']
    const gapH = (await reqColsOf(t.head)).filter((c) => !new Set([...hMap.map((x) => x[1]), ...FIXED, ...FILLABLE]).has(c))
    const gapL = (await reqColsOf(t.line)).filter((c) => !new Set([...lMap.map((x) => x[1]), ...FIXED]).has(c))
    if (gapH.length || gapL.length) say(`- ⚠ ${t.kdName}:必填列未覆盖 —— 头[${gapH.join(', ') || '无'}] 行[${gapL.join(', ') || '无'}]`)
  }

  // ① 列表(按支持的时间键过滤;客户端再按单据日期精筛)
  const base = `/jdy/v2/scm/${t.kd}`
  const filterKey = t.timeKey === 'modify' ? 'modify' : 'create'
  const rows = []
  for (let page = 1; page <= 400; page++) {
    const r = await kingdeeTryGet(cfg, token, base, {
      bill_status: 'C', page: String(page), page_size: '50',
      [`${filterKey}_start_time`]: fromMs, [`${filterKey}_end_time`]: toMs,
    })
    if (!r.ok) { say(`- ❌ ${t.kdName} 列表第 ${page} 页失败:${String(r.error).slice(0, 100)}`); break }
    const got = r.data.rows || []
    rows.push(...got)
    if (got.length < 50) break
    await sleep(120)
  }
  const inRange = rows.filter((x) => x.bill_date && x.bill_date >= FROM && x.bill_date <= TO)
  const pick = LIMIT ? inRange.slice(0, LIMIT) : inRange
  const keyOf = (h) => (t.keyCol === '外部数据ID' ? S(h.id) : S(h.bill_no))

  let ok = 0, lineN = 0, fail = 0
  for (const row of pick) {
    try {
      const d = (await kingdeeTryGet(cfg, token, t.detail, { id: String(row.id) })).data || {}
      const head = {}
      for (const [kd, col] of hMap) head[col] = toVal(d[kd], headCols.get(col).typ, headCols.get(col).max_length)
      head['单据状态'] = headCols.has('单据状态') ? (d.bill_status === 'C' ? '已审核' : '草稿') : undefined
      if (headCols.has('是否已转ERP')) head['是否已转ERP'] = '是'
      if (headCols.has('ERP单号')) head['ERP单号'] = S(d.bill_no)
      if (headCols.has('转ERP操作人')) head['转ERP操作人'] = '试运行'
      if (headCols.has('转ERP时间')) head['转ERP时间'] = new Date()
      if (headCols.has('asp_user1')) head['asp_user1'] = '试运行'
      if (headCols.has('asp_time1')) head['asp_time1'] = new Date()
      if (headCols.has('asp_cancel')) head['asp_cancel'] = 'N'
      // 必填列兜底(2026-10-16):金蝶这几个接口不回「币种名称/业务类型名称」,而本地列 NOT NULL 无默认
      //   (bd_pu_order/bd_purchase_in 的 币种·汇率;bd_purchase_in/bd_sale_out/bd_material_out/bd_finish_in
      //    的 业务类型;bd_sale_out 的 结算客户)—— 不兜底则逐单 INSERT 失败。
      // 口径:币种恒「人民币」(与同步器一致,deploy/README.md §7);汇率取金蝶 exchange_rate,缺则 1;
      //   业务类型金蝶该接口只回 trans_type 码、无名称 ⇒ 空串(与本地既有采购入库单该列一致);
      //   结算客户金蝶出库单不回 ⇒ 取「客户」。
      const fill = (col, v) => { if (headCols.has(col) && (head[col] === undefined || head[col] === null || head[col] === '')) head[col] = v }
      fill('币种', '人民币')
      fill('汇率', N(d.exchange_rate) ?? 1)
      fill('业务类型', '')
      fill('结算客户', head['客户'])
      for (const k of Object.keys(head)) if (head[k] === undefined) delete head[k]

      const lines = (d.material_entity || []).map((m) => {
        const o = { 单据编号: S(d.bill_no) }
        for (const [kd, col] of lMap) o[col] = toVal(m[kd], lineCols.get(col).typ, lineCols.get(col).max_length)
        if (lineCols.has('asp_user1')) o['asp_user1'] = '试运行'
        if (lineCols.has('asp_time1')) o['asp_time1'] = new Date()
        if (lineCols.has('asp_cancel')) o['asp_cancel'] = 'N'
        return o
      })

      // ② 幂等整单重插(事务)
      const tx = new mssql.Transaction(pool); await tx.begin()
      try {
        const docNo = S(d.bill_no)
        await new mssql.Request(tx).query(`DELETE FROM ${t.line} WHERE 单据编号 = N'${docNo.replace(/'/g, "''")}'`)
        await new mssql.Request(tx).query(`DELETE FROM ${t.head} WHERE ${t.keyCol} = N'${String(keyOf(d)).replace(/'/g, "''")}'`)
        const ins = async (tbl, obj) => {
          const ks = Object.keys(obj).filter((k) => obj[k] !== null)
          if (!ks.length) return
          const req = new mssql.Request(tx)
          ks.forEach((k, i) => req.input('p' + i, obj[k]))
          await req.query(`INSERT INTO ${tbl} (${ks.map((k) => `[${k}]`).join(',')}) VALUES (${ks.map((_, i) => '@p' + i).join(',')})`)
        }
        await ins(t.head, head)
        for (const ln of lines) await ins(t.line, ln)
        await tx.commit()
        ok++; lineN += lines.length
      } catch (e) { await tx.rollback(); throw e }
      await sleep(120)
    } catch (e) {
      fail++
      if (fail <= 3) say(`- ❌ ${t.kdName} ${row.bill_no} 失败:${String(e.message).slice(0, 160)}`)
    }
  }
  grandOk += ok; grandLine += lineN; grandFail += fail
  say(`| ${t.kdName} | ${inRange.length} | ${ok} | ${lineN} | ${fail} | 过滤键 ${filterKey}_*;幂等键 ${t.keyCol} |`)
}
say('')
say(`**合计**:成功拉取 ${grandOk} 张单据 / ${grandLine} 条明细,失败 ${grandFail} 张。`)

mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
const RUNSTAMP = TO.replace(/-/g, '').slice(4)   // 报告名带运行日期(MMDD),不覆盖上一轮留档
writeFileSync(new URL(`./_dump-out/kingdee-pull-${TAG}-${RUNSTAMP}.md`, import.meta.url), report.join('\n'), 'utf8')
await pool.close()
console.log(`\n[产物] tools/archive/_dump-out/kingdee-pull-${TAG}-${RUNSTAMP}.md`)



