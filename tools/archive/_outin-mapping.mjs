/**
 * 金蝶出入库单据 ↔ MES 字段映射(唯一真源,2026-10-14 建立)
 *
 * 谁在用:
 *   · tools/archive/_pull-kingdee-samples-1014.mjs —— 取样时按它把金蝶单据写进 MES
 *   · tools/archive/_gen-outin-doc-md.mjs        —— 生成《出入库单据字段与显示字段》时按它输出「金蝶键」列
 * ⇒ 改映射只改这里,两处同步(用户口径「方便别人同步时统一字段」)。
 *
 * 映射规则(全部经**实测核对**,不是推测):
 *   · 覆盖范围来自金蝶 30 张真实单据的逐键非空率统计(_dump-out/kingdee-3docs-fieldfill-1014.md)
 *     —— 只映射「有数据」的键 + 链路必需键;恒空键在文档里列明「未登记及原因」。
 *   · 表头/明细的 MES 列名沿用参照面板词汇(bl_purchase_in / bd_material_out / v_purchase_in_detail 等)。
 *   · 端到端核对结论:3 类单据逐字段 **0 处不一致**(见 _dump-out/kingdee-samples-verify-1014.md)。
 *
 * 数据结构:[金蝶键, MES 物理列, 适用范围?] —— 第三项省略 = 三类通用;给了 = 仅这些类型适用。
 */
export const HEAD_MAP = [
  ['bill_no', '单据编号'], ['bill_no', '外部单据号'], ['id', '外部数据ID'],
  ['bill_date', '单据日期'],
  // 单据状态:物理列有(与采购入库单/产成品入库单/材料出库单同款),但不登记为**显示字段**
  // —— 界面状态由 yj_doc_status 派生(参照面板同款)
  ['bill_status', '单据状态'],
  ['bill_type_name', '单据类型', ['inv_product']],
  // bd_finish_in.业务类型 是 NOT NULL(两账套已对齐,见 migrate-finish-in-notnull-align-20261015.sql)
  ['bill_type_name', '业务类型', ['inv_product']],
  ['trans_type_name', '业务类型', ['inv_other_in', 'inv_other_out']],
  ['trans_type_number', '业务类型编码', ['inv_other_in', 'inv_other_out']],
  ['trans_type_id', '业务类型id', ['inv_other_in', 'inv_other_out']],
  ['supplier_number', '供应商编码', ['inv_other_in']], ['supplier_name', '供应商', ['inv_other_in']],
  // 部门/经手人:产品入库单与其他出库单有(其他入库单是供应商口径,表里没有这两族列)
  ['dept_name', '部门', ['inv_product', 'inv_other_out']], ['dept_number', '部门编码', ['inv_product', 'inv_other_out']],
  ['emp_name', '经手人', ['inv_product', 'inv_other_out']], ['emp_number', '经手人编码', ['inv_product', 'inv_other_out']],
  ['creator_name', '创建人'], ['create_time', '创建时间'],
  ['modifier_name', '修改人'], ['modify_time', '修改时间'],
  ['auditor_name', '审核人'], ['audit_time', '审核时间'],
  ['auditor_name', '金蝶审核人'], ['audit_time', '金蝶审核时间'],
  ['remark', '备注'],
]

export const LINE_MAP = [
  ['seq', '序号'],
  ['material_number', '产品编码', ['inv_product']], ['material_name', '产品名称', ['inv_product']],
  ['material_number', '存货编码', ['inv_other_in', 'inv_other_out']], ['material_name', '存货名称', ['inv_other_in', 'inv_other_out']],
  ['material_model', '规格型号'],
  ['stock_name', '仓库'], ['stock_number', '仓库编码', ['inv_other_in', 'inv_other_out']],
  ['unit_name', '计量单位'],
  ['base_unit_name', '基本单位名称'], ['base_unit_number', '基本单位编码'], ['base_unit_id', '基本单位id'],
  ['aux_unit_name', '辅助单位名称'], ['aux_unit_number', '辅助单位编码'], ['aux_unit_id', '辅助单位id'],
  ['conversion_rate', '换算率'], ['coefficient', '换算系数'], ['aux_coefficient', '辅助换算系数'],
  ['qty', '实收数量', ['inv_product']], ['qty', '数量', ['inv_other_in', 'inv_other_out']],
  ['aux_qty', '辅助数量', ['inv_other_in', 'inv_other_out']],
  ['inv_qty', '库存数量'],
  ['batch_no', '批号', ['inv_product', 'inv_other_in', 'inv_other_out']],
  ['picture', '存货图片', ['inv_product', 'inv_other_in']],
  ['cost', '成本', ['inv_other_in']], ['unit_cost', '单位成本', ['inv_other_in']],
  ['comment', '备注', ['inv_product']], ['comment', '明细备注', ['inv_other_in', 'inv_other_out']],
]

/** 未被映射键(金蝶有键但 MES 不落列):报出「键 → 为何不落」,让「完全对照」可审计 */
const ID_REASON = '金蝶**内部 id**(账套间不同):转ERP 时按编码向目标账套解析,不落 MES —— 落进来跨账套必错'
const ID2_REASON = '金蝶内部编号(形如 multicorp_…/账号串),非业务字段'
export const SKIP_REASON = {
  // 内部 id 族(转ERP 时按编码解析,不落 MES)
  material_id: ID_REASON, stock_id: ID_REASON, unit_id: ID_REASON,
  base_unit_id: ID_REASON, aux_unit_id: ID_REASON, sp_id: ID_REASON,
  dept_id: ID_REASON, emp_id: ID_REASON, supplier_id: ID_REASON, customer_id: ID_REASON,
  creator_id: ID_REASON, modifier_id: ID_REASON, auditor_id: ID_REASON,
  creator_number: ID2_REASON, modifier_number: ID2_REASON, auditor_number: ID2_REASON,
  // 编码族:MES 落名称/或由名称解析(逐条说明)
  unit_number: '与 unit_name 同义:MES 落「计量单位」名称,转ERP 按名称解析 unit_id',
  base_unit_number: '同 base_unit_id 口径:MES 落「基本单位名称」,转ERP 按名称解析',
  aux_unit_number: '同上(MES 落「辅助单位编码」的是其他入库/其他出库;产品入库单 3% 才有值)',
  stock_number: '产品入库单行表**没有**「仓库编码」列:转ERP 由「仓库」名称经 bs_wh 解析成编码(端到端已验证);其他入库/其他出库两单已映射该列',
  base_qty: '金蝶按 qty × 换算系数自算,保存接口不接受(MES 只落 qty)',
  inv_base_qty: '恒空',
  bill_status: '已映射到「单据状态」物理列,但**不登记为显示字段**(界面状态由 yj_doc_status 派生,与参照面板同款)',
  bill_type_id: '金蝶单据类型常量(如 inv_product_bill):MES 落「单据类型」名称即可,常量无业务含义',
  bill_type_number: '同 bill_type_id',
  dept_number: '已映射(「部门编码」)',
  emp_number: '已映射(「经手人编码」)',
  material_number: '已映射(产品入库单=「产品编码」/ 其他两单=「存货编码」)',
  material_name: '已映射(产品入库单=「产品名称」/ 其他两单=「存货名称」)',
  price: '恒空(其他入库 0% / 其他出库 0%);有值的成本族已单列',
  amount: '金蝶无此键(金额是 MES 业务列,自算)',
  cost: '仅其他入库有值(19%),产品入库/其他出库恒空 ⇒ 只在其他入库落列',
  unit_cost: '同上',
  sp_name: '恒空(仓位;真实账套这三类单据不走仓位)',
  sp_number: '同上',
  src_bill_no: '恒空(这三类单据在金蝶无来源单下推)',
  src_bill_type_id: '同上', src_bill_type_number: '同上', src_bill_type_name: '同上',
  src_seq: '同上', src_entry_id: '同上', src_inter_id: '同上', src_bill_date: '同上',
  barcode: '恒空', pro_place: '恒空', pro_reg_no: '恒空', pro_license: '恒空',
  kf_date: '恒空(保质期族)', kf_period: '恒空', kf_type: '恒空', valid_date: '恒空',
  sn_list: '恒空(序列号族)', sn_list_id: '恒空',
  aux_prop_id: '恒空(辅助属性族)', aux_prop_name: '恒空', aux_prop_number: '恒空',
  aux1_id: '恒空', aux1_name: '恒空', aux1_number: '恒空',
  aux2_id: '恒空', aux2_name: '恒空', aux2_number: '恒空',
  aux3_id: '恒空', aux3_name: '恒空', aux3_number: '恒空',
  aux_qty: '多单位商品才有值(产品入库 3% / 其他出库恒空);其他入库已映射「辅助数量」',
  aux_coefficient: '同上(其他入库已映射「辅助换算系数」)',
  conversion_rate: '多单位商品才有值(3%);其他入库已映射「换算率」',
  def_float_qty: '恒空',
  material_is_batch: '商品属性(批次管理),非单据数据;批次号本身已映射到「批号」',
  material_is_multi_unit: '商品属性(多单位),同上',
  material_is_serial: '商品属性(序列号),恒空', material_is_asst_attr: '商品属性(辅助属性),恒空',
  material_is_kf_period: '商品属性(保质期),恒空',
  stock_is_allow_freight: '仓库属性,恒空',
  custom_field: '恒空(自定义字段容器)',
  custom_entity_field: '恒空(分录自定义字段容器)',
  contact_phone: '恒空(联系人族)', contact_address: '恒空',
  contact_city: '恒空', contact_city_id: '恒空', contact_city_name: '恒空', contact_city_number: '恒空',
  contact_country_id: '恒空', contact_country_name: '恒空', contact_country_number: '恒空',
  contact_district_id: '恒空', contact_district_name: '恒空', contact_district_number: '恒空',
  contact_province_id: '恒空', contact_province_name: '恒空', contact_province_number: '恒空',
  contact_linkman: '恒空',
  acceptor_id: '恒空(验收人,仅产品入库单有此键且 0%)',
  acceptor_name: '恒空', acceptor_number: '恒空',
  customer_name: '恒空(其他出库/入库的客户族;其他出库走部门+经手人)',
  customer_number: '恒空', customer_id: '恒空',
  supplier_name: '已映射(「供应商」,仅其他入库单)',
  supplier_number: '已映射(「供应商编码」,仅其他入库单)',
  trans_type_id: '已映射(「业务类型id」,其他入库/其他出库)',
  trans_type_name: '已映射(「业务类型」)', trans_type_number: '已映射(「业务类型编码」)',
  picture: '已映射(「存货图片」;产品入库 14% / 其他入库 14% 有值)',
  comment: '已映射(产品入库=「备注」/ 其他两单=「明细备注」)',
  seq: '已映射(「序号」)', qty: '已映射(产品入库=「实收数量」/ 其他两单=「数量」)',
  inv_qty: '已映射(「库存数量」)', batch_no: '已映射(「批号」;产品入库 67% / 其他出库 93%)',
  material_model: '已映射(「规格型号」)',
  create_time: '已映射(「创建时间」)', modify_time: '已映射(「修改时间」)', audit_time: '已映射(「审核时间」/「金蝶审核时间」)',
  remark: '表头备注已映射;三类单据该键恒空 ⇒ 列建了但不登记为显示字段',
}

export const applies = (rule, api) => !rule || rule.includes(api)
