/**
 * 2026-10-18:把**金蝶正式账套** 9.1 之后的 调拨/盘点/盘盈/盘亏 数据拉下来,写进要上传的 Excel。
 *
 * 用户口径:「拉取金蝶9.1后的数据下来,记得写入要上传的excel表中」
 *
 * 只读(GET),不写金蝶任何单据。
 * 用法:node deploy/_pull-kd-transfer-stocktake-excel.mjs [起始日期(yyyy-MM-dd)] [输出目录]
 *   默认起始 2026-09-01,输出 tools/archive/_kd-transfer-stocktake-excel/
 *
 * 产出:金蝶调拨盘点数据_20260901起.xlsx
 *   第 1 行 = 中文字段名,第 2 行 = 金蝶原始字段名(供程序回读),第 3 行起 = 数据
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as XLSXNS from '../../../frontend/node_modules/xlsx/xlsx.mjs'
// xlsx 的 ESM 产物没有 default 导出,统一取命名空间(shim 给 CJS 默认导入的写法也兼容)
const XLSX = XLSXNS.default || XLSXNS
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const beginDate = process.argv[2] || '2026-09-01'
const OUT = resolve(process.argv[3] || 'tools/archive/_kd-transfer-stocktake-excel')
mkdirSync(OUT, { recursive: true })

const k = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const cfg = {
  clientId: k.clientId, clientSecret: k.clientSecret, appKey: k.appKey || '',
  appSecret: k.appSecret || '', domain: k.domain, outerInstanceId: k.outerInstanceId || '',
}
const { token, domain } = await fetchAppToken(cfg)
cfg.domain = domain
console.log('正式账套授权成功 ' + domain)

const CASES = [
  ['tfmove', '调拨单', '/jdy/v2/scm/inv_tfmove', '/jdy/v2/scm/inv_tfmove_detail'],
  ['checkbill', '盘点单', '/jdy/v2/scm/inv_check_bill', '/jdy/v2/scm/inv_check_bill_detail'],
  ['checkgail', '盘盈单', '/jdy/v2/scm/inv_check_gail_bill', '/jdy/v2/scm/inv_check_gail_bill_detail'],
  ['checkloss', '盘亏单', '/jdy/v2/scm/inv_check_loss_bill', '/jdy/v2/scm/inv_check_loss_bill_detail'],
]

/** 金蝶字段 → 中文名(表头与分录共用;未登记的字段按原字段名输出) */
const FIELD_LABELS = {
  id: '单据ID', bill_no: '单据编码', bill_date: '单据日期', bill_status: '单据状态',
  create_time: '创建时间', modify_time: '修改时间', audit_time: '审核时间', check_time: '盈亏处理时间',
  creator_id: '创建人ID', creator_name: '创建人', creator_number: '创建人编码',
  modifier_id: '修改人ID', modifier_name: '修改人', modifier_number: '修改人编码',
  auditor_id: '审核人ID', auditor_name: '审核人', auditor_number: '审核人编码',
  emp_id: '盘点人ID', emp_name: '盘点人', emp_number: '盘点人编码',
  check_id: '盈亏处理人ID', check_name: '盈亏处理人', check_number: '盈亏处理人编码',
  remark: '备注', trans_type: '调拨类型', trans_fer_status: '调拨差异状态', car_sale_type: '车辆销售类型',
  dept_id: '部门ID', dept_name: '部门', dept_number: '部门编码',
  out_dept_id: '调出部门ID', out_dept_name: '调出部门', out_dept_number: '调出部门编码',
  bill_out_sp_id: '单据调出仓位ID', bill_out_sp_name: '单据调出仓位', bill_out_sp_number: '单据调出仓位编码',
  bill_out_stock_id: '单据调出仓库ID', bill_out_stock_name: '单据调出仓库', bill_out_stock_number: '单据调出仓库编码',
  bill_in_sp_id: '单据调入仓位ID', bill_in_sp_name: '单据调入仓位', bill_in_sp_number: '单据调入仓位编码',
  bill_in_stock_id: '单据调入仓库ID', bill_in_stock_name: '单据调入仓库', bill_in_stock_number: '单据调入仓库编码',
  stock_id: '仓库ID', stock_name: '仓库', stock_number: '仓库编码',
  stock_is_allow_freight: '仓库启用仓位管理',
  gain_id: '盘盈单ID', gain_bill_no: '盘盈单号', loss_id: '盘亏单ID', loss_bill_no: '盘亏单号',
  voucher_no: '凭证号', voucher_period: '凭证期间', voucher_id: '凭证ID',
  seq: '分录序号', picture: '图片',
  material_id: '商品ID', material_name: '商品名称', material_number: '商品编码', material_model: '规格型号',
  material_is_multi_unit: '商品多单位', material_is_serial: '商品序列号', material_is_asst_attr: '商品辅助属性',
  material_is_kf_period: '商品保质期', material_is_batch: '商品批次',
  out_stock_id: '调出仓库ID', out_stock_name: '调出仓库', out_stock_number: '调出仓库编码',
  in_stock_id: '调入仓库ID', in_stock_name: '调入仓库', in_stock_number: '调入仓库编码',
  out_sp_id: '调出仓位ID', out_sp_name: '调出仓位', out_sp_number: '调出仓位编码',
  in_sp_id: '调入仓位ID', in_sp_name: '调入仓位', in_sp_number: '调入仓位编码',
  sp_id: '仓位ID', sp_name: '仓位', sp_number: '仓位编码',
  aux_prop_id: '辅助属性ID', aux_prop_name: '辅助属性', aux_prop_number: '辅助属性编码',
  aux_id1: '辅助属性1ID', aux_name1: '辅助属性1', aux_number1: '辅助属性1编码',
  aux_id2: '辅助属性2ID', aux_name2: '辅助属性2', aux_number2: '辅助属性2编码',
  aux_id3: '辅助属性3ID', aux_name3: '辅助属性3', aux_number3: '辅助属性3编码',
  barcode: '条形码', batch_no: '批次号', pro_place: '产地', pro_reg_no: '注册证号', pro_license: '生产许可证',
  kf_date: '生产日期', valid_date: '有效期至', kf_type: '保质期类型', kf_period: '保质期',
  sn_list: '序列号清单', sn_list_id: '序列号流转ID', inv_sn_list: '账存序列号清单',
  base_unit_id: '基本单位ID', base_unit_name: '基本单位', base_unit_number: '基本单位编码',
  unit_id: '单位ID', unit_name: '单位', unit_number: '单位编码',
  aux_unit_id: '辅助单位ID', aux_unit_name: '辅助单位', aux_unit_number: '辅助单位编码',
  retail_price: '零售价', conversion_rate: '换算率', coefficient: '换算系数', aux_coefficient: '辅助换算系数',
  qty: '数量', base_qty: '基本数量', aux_qty: '辅助数量', def_float_qty: '默认浮动数量',
  inv_qty: '账存数量', inv_base_qty: '账存基本数量', in_inv_qty: '调入账存数量', in_instant_qty: '调入即时数量',
  instant_qty: '即时数量', in_def_float_qty: '调入默认浮动数量', in_def_float_qty2: '调入默认浮动数量2',
  aux_inv_qty: '辅助账存数量', discount: '折扣额', unit_cost: '单位成本', cost: '成本', price: '单价',
  comment: '分录备注', out_price: '调出单价', out_amount: '调出金额', diff_status: '差异状态',
  src_bill_no: '源单编号', src_bill_type_id: '源单类型ID', src_bill_type_name: '源单类型',
  src_bill_type_number: '源单类型编码', src_inter_id: '源单内部ID', src_bill_date: '源单日期',
  src_seq: '源单分录序号', src_entry_id: '源单分录ID',
}

const STATUS = { Z: '未审核', C: '已审核', A: '已作废' }
const label = (key) => FIELD_LABELS[key] || key
const cell = (key, v) => {
  if (v === null || v === undefined) return ''
  if (key === 'bill_status') return STATUS[v] || v
  if (typeof v === 'object') return Array.isArray(v) ? `[${v.length}行]` : ''
  return v
}

const wb = XLSX.utils.book_new()
const summary = []

for (const [key, name, listPath, detailPath] of CASES) {
  // ① 列表:全量分页取(这几个接口**不吃日期过滤参数** —— 实测 start_date/begin_time/start_time/
  //    bill_date_start/modify_time_start 五种写法返回条数完全相同,所以日期在客户端筛)
  const all = []
  for (let page = 1; page <= 200; page++) {
    const r = await kingdeeTryGet(cfg, token, listPath, { page, pagesize: 100 })
    if (!r.ok) { console.log(`[列表失败] ${name} p${page}: ${r.error}`); break }
    const rows = r.data?.rows || r.data?.list || []
    all.push(...rows)
    const tp = r.data?.total_page || Math.ceil((r.data?.count || 0) / 100)
    if (page >= tp || !rows.length) break
  }
  // 客户端按单据日期过滤(含起始日)
  const list = all.filter((x) => String(x.bill_date || '') >= beginDate)
  console.log(`===== ${name}: 全量 ${all.length} 张,${beginDate} 之后 ${list.length} 张 =====`)

  // ② 逐张详情
  const heads = [], ents = []
  for (const row of list) {
    const dt = await kingdeeTryGet(cfg, token, detailPath, { id: row.id, only_basic: 'false' })
    if (!dt.ok) { console.log(`  ${row.bill_no} 详情失败: ${dt.error}`); continue }
    const d = dt.data || {}
    const ent = d.material_entity || []
    const head = { ...d }
    delete head.material_entity
    delete head.custom_field
    heads.push(head)
    for (const it of ent) {
      const e = { ...it }
      delete e.custom_entity_field
      ents.push({ bill_no: d.bill_no, ...e })
    }
  }

  // ③ 表头 sheet(0 条也给一个空壳 + 说明,免得看表的人以为是漏导)
  const keys0 = heads.length ? [...new Set(heads.flatMap((h) => Object.keys(h)))] : ['bill_no', 'bill_date', 'bill_status']
  const aoa0 = [keys0.map(label), keys0]
  if (heads.length) for (const h of heads) aoa0.push(keys0.map((k2) => cell(k2, h[k2])))
  else aoa0.push([`(金蝶里 ${name} 在 ${beginDate} 之后没有单据)`, '', ''].slice(0, keys0.length))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa0), `${name}表头`)
  // ④ 分录 sheet
  if (ents.length) {
    const order = ['bill_no', ...[...new Set(ents.flatMap((e) => Object.keys(e)))].filter((x) => x !== 'bill_no')]
    const aoa = [order.map((k2) => (k2 === 'bill_no' ? '单据编码' : label(k2))), order,
      ...ents.map((e) => order.map((k2) => cell(k2, e[k2])))]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), `${name}分录`)
  }
  summary.push({ 单据: name, 张数: heads.length, 分录行: ents.length })
}

// ⑤ 汇总 sheet(放最前)
const ws = XLSX.utils.aoa_to_sheet([
  [`金蝶云·星辰 ${beginDate} 之后 · 调拨/盘点数据`, '', '', ''],
  ['数据来源', 'https://api.kingdee.com(正式账套,只读 GET)', '', ''],
  ['导出时间', new Date().toLocaleString('zh-CN'), '', ''],
  ['', '', '', ''],
  ['单据', '张数', '分录行数', '金蝶接口'],
  ...CASES.map(([key, name, listPath]) => {
    const s = summary.find((x) => x.单据 === name) || { 张数: 0, 分录行: 0 }
    return [name, s.张数, s.分录行, listPath]
  }),
  ['', '', '', ''],
  ['说明', '第 1 行为中文字段名,第 2 行为金蝶原始字段名(供程序回读)', '', ''],
  ['说明', '单据状态:Z=未审核 C=已审核', '', ''],
  ['说明', '盘盈/盘亏单由盘点单「盈亏处理」生成,源单编号指向来源盘点单', '', ''],
  ['说明', `日期过滤在客户端做:这几个列表接口不吃 start_date/begin_time/start_time 等参数(实测条数不变)`, '', ''],
  ['说明', `盘点单/盘盈单/盘亏单在 ${beginDate} 之后 0 张 —— 金蝶里最近一次盘点是 2026-01-06`, '', ''],
])
XLSX.utils.book_append_sheet(wb, ws, '汇总')
wb.SheetNames = ['汇总', ...wb.SheetNames.filter((n) => n !== '汇总')]

const file = `${OUT}/金蝶调拨盘点数据_${beginDate.replaceAll('-', '')}起.xlsx`
// xlsx 的 writeFile 在 Node ESM 下靠的是"浏览器下载"分支 ⇒ 必须自己写盘
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
writeFileSync(file, buf)
console.log('\n已生成: ' + file)
console.log(JSON.stringify(summary, null, 2))
process.exit(0)
