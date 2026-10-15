/**
 * 生成器(2026-10-14)Phase 2:重建「其他入库单 / 其他出库单」三件套(单据 + 明细表 + 统计表)。
 *
 * 背景:MES 的 OTHER_IN / OTHER_OUT(含 _DETAIL / _STATS 共 6 个面板)与 10 张物理表、
 *   8 个视图于 2026-10-08 按用户口径整体下架(tools/migrate-drop-extra-docs-pu-req-20261008.sql,
 *   回退抓手 tools/archive/_panel-age/_backup-20261008/)。
 *   用户 2026-10-14 口径:「其他出库/入库也是一样(同产品入库:补转ERP + 字段对照金蝶),
 *   详细和统计也要做」⇒ 本生成器按金蝶接口字段重建,并保留原面板编码/单号前缀/模块归属。
 *
 * 字段来源(全部实测,不靠猜):
 *   · 金蝶字段清单   tools/archive/_dump-out/kingdee-3docs-fields-1014.md
 *   · 逐键非空率统计 tools/archive/_dump-out/kingdee-3docs-fieldfill-1014.md(取样 30 张真实单据)
 *     其他入库:表头 48 键(恒空 26)/分录 73 键(恒空 44)→ 有值 22 / 29
 *     其他出库:表头 45 键(恒空 20)/分录 73 键(恒空 52)→ 有值 25 / 21
 *   · 保存接口实测     tools/archive/_dump-out/kingdee-save-inv-other-1014.md
 *                      tools/archive/_dump-out/kingdee-transtype-1014.md
 *     ⚠ 其他入库/出库保存**必须传 trans_type_id**(单发 number/name/trans_type 都报「请填写"业务类型"」),
 *       而金蝶**没有业务类型档案接口**(9 条候选路径全 519)⇒ 只能按账套在 MES 侧配置 id
 *       (真实账套实测:其他入库=12 / 其他出库=13)。
 *
 * 命名口径对照参照面板(用户点名「显示字段对照采购入库单和销售出库单来」):
 *   表头/明细/视图列名一律沿用 bl_purchase_in / bl_material_out / v_purchase_in_detail / v_purchase_in_stats 的词汇。
 *
 * 用法: node tools/archive/_gen-other-docs-migration.mjs
 * 产物: tools/migrate-other-docs-rebuild-20261014.sql
 */
import { writeFileSync } from 'node:fs'

const HEAD_SIDE = (bizName) => [
  // [列名, 类型, 中文注明, 字段类型, place, seq, width, editable, required, hidden, visible, 取数口径?]
  // 取数口径(第 12 项)= { dict } 下拉候选 / { ref, refField, disp } 参照源 —— 口径照抄参照面板
  //   (采购入库单/销售出库单/产成品入库单):用户 2026-10-14 反馈「其他出库和入库没有下拉数据下来」。
  ['单据日期', 'date', '单据日期(金蝶 bill_date)', '日期', 'query,header', 10, 140, 0, 1, 0, 1],
  ['单据编号', 'nvarchar(50)', '单据编号(MES 单号;金蝶侧单号存 外部单据号)', '文本', 'query,header', 20, 140, 0, 1, 0, 1],
  // 单据状态:物理列有(与 bd_purchase_in/bd_finish_in/bd_material_out 同款),但**不登记为面板字段**
  // —— 参照面板都不登记它,界面状态由 yj_doc_status 派生(见 NO_FIELD)
  ['单据状态', 'nvarchar(20)', '单据状态(MES 单据状态快照;面板不登记该字段,界面状态由 yj_doc_status 派生 —— 与采购入库单/产成品入库单/材料出库单同款)', '文本', 'header', 22, 100, 0, 0, 1, 0],
  // 业务类型:下拉框(候选 = 金蝶业务类型名;口径同产成品入库单的「业务类型」下拉)
  ['业务类型', 'nvarchar(50)', `业务类型(金蝶 trans_type_name;候选 = ${bizName})`, '下拉框', 'query,header', 30, 120, 0, 1, 0, 1, { dict: `SELECT v FROM (VALUES (N'${bizName}')) AS t(v)` }],
  ['业务类型编码', 'nvarchar(50)', '业务类型编码(金蝶 trans_type_number,如 QTRKLX01/QTCKLX01)', '文本', 'header', 32, 120, 0, 0, 0, 1],
  ['业务类型id', 'nvarchar(20)', '业务类型id(金蝶 trans_type_id,保存接口**必需**;无档案接口故按账套配置:真实账套 其他入库=12 / 其他出库=13)', '文本', 'header', 34, 90, 1, 0, 0, 1],
]

const COMMON_HEAD_TAIL = [
  ['备注', 'nvarchar(500)', '备注(金蝶 remark)', '文本', 'header', 900, 200, 1, 0, 0, 1],
  ['创建人', 'nvarchar(50)', '创建人(金蝶 creator_name)', '文本', 'header', 140, 100, 0, 0, 1, 0],
  ['创建时间', 'nvarchar(30)', '创建时间(金蝶 create_time;按同族面板惯例存文本)', '文本', 'header', 142, 130, 0, 0, 1, 0],
  ['修改人', 'nvarchar(50)', '修改人(金蝶 modifier_name)', '文本', 'header', 144, 100, 0, 0, 1, 0],
  ['修改时间', 'nvarchar(30)', '修改时间(金蝶 modify_time)', '文本', 'header', 146, 130, 0, 0, 1, 0],
  ['审核人', 'nvarchar(50)', '审核人(MES 审核留痕 / 金蝶 auditor_name)', '文本', 'header', 150, 100, 0, 0, 0, 1],
  ['审核时间', 'datetime2', '审核时间(金蝶 audit_time)', '日期', 'header', 152, 130, 0, 0, 0, 1],
  ['外部数据ID', 'nvarchar(50)', '外部数据ID(金蝶单据内部 id;拉取同步幂等键,与 bd_so_order/bd_pu_order 同款)', '文本', 'header', 162, 120, 0, 0, 1, 0],
  ['外部单据号', 'nvarchar(50)', '外部单据号(金蝶侧单号,如 QTRK-20261014-00092 / QTCK-20261014-01172)', '文本', 'header', 160, 130, 0, 0, 0, 1],
  ['外部指纹', 'nvarchar(200)', '外部指纹(金蝶关键字段拼接,增量同步变更判据)', '文本', 'header', 164, 160, 0, 0, 1, 0],
  ['是否已转ERP', 'nvarchar(10)', '是否已转ERP(转ERP 成功置「是」;弃审由 ButtonService 清回「否」)', '文本', 'header', 172, 80, 0, 0, 1, 1],
  ['ERP单号', 'nvarchar(50)', 'ERP单号(金蝶保存响应 data.id_number_map 回写)', '文本', 'header', 170, 120, 0, 0, 0, 1],
  ['转ERP操作人', 'nvarchar(50)', '转ERP操作人', '文本', 'header', 174, 100, 0, 0, 0, 1],
  ['转ERP时间', 'datetime2', '转ERP时间', '日期', 'header', 176, 130, 0, 0, 0, 1],
  ['金蝶单据状态', 'nvarchar(20)', '金蝶单据状态(拉取回填)', '文本', 'header', 178, 100, 0, 0, 0, 1],
  ['金蝶审核人', 'nvarchar(50)', '金蝶审核人(拉取回填)', '文本', 'header', 180, 130, 0, 0, 0, 1],
  ['金蝶审核时间', 'nvarchar(30)', '金蝶审核时间(拉取回填)', '文本', 'header', 182, 130, 0, 0, 0, 1],
]

const LINE_COLS = [
  ['序号', 'int', '序号(金蝶分录 seq)', '整数', 'detail', 5, 60, 0, 0, 0, 1],
  // 存货:参照 商品档案 INV(口径照抄采购入库单:编码 ref=存货编码/disp=存货名称,名称 ref=存货名称)
  ['存货编码', 'nvarchar(50)', '存货编码(金蝶 material_number;参照商品档案)', '参照', 'query,detail', 10, 120, 1, 0, 0, 1, { ref: 'INV', refField: '存货编码', disp: '存货名称' }],
  ['存货名称', 'nvarchar(100)', '存货名称(金蝶 material_name;参照商品档案)', '参照', 'detail', 20, 160, 1, 0, 0, 1, { ref: 'INV', refField: '存货名称', disp: '存货名称' }],
  ['规格型号', 'nvarchar(100)', '规格型号(金蝶 material_model)', '文本', 'detail', 30, 140, 1, 0, 0, 1],
  // 仓库:参照 仓库档案 WH(口径照抄采购入库单:名称 ref=仓库名称,编码 ref=仓库编码/disp=仓库名称)
  ['仓库', 'nvarchar(50)', '仓库(金蝶 stock_name;参照仓库档案)', '参照', 'query,detail', 40, 110, 1, 0, 0, 1, { ref: 'WH', refField: '仓库名称', disp: '仓库名称' }],
  ['仓库编码', 'nvarchar(50)', '仓库编码(金蝶 stock_number;转ERP 按它解析 stock_id)', '参照', 'query,detail', 42, 100, 1, 0, 1, 0, { ref: 'WH', refField: '仓库编码', disp: '仓库名称' }],
  // 计量单位:下拉框(候选口径与采购入库单/产成品入库单一致)
  ['计量单位', 'nvarchar(20)', '计量单位(金蝶 unit_name)', '下拉框', 'detail', 60, 100, 1, 0, 0, 1, { dict: "SELECT v FROM (VALUES (N'件'),(N'kg'),(N'套'),(N'升')) AS t(v)" }],
  ['基本单位名称', 'nvarchar(50)', '基本单位名称(金蝶 base_unit_name)', '文本', 'detail', 62, 100, 0, 0, 0, 1],
  ['基本单位编码', 'nvarchar(50)', '基本单位编码(金蝶 base_unit_number)', '文本', 'detail', 63, 100, 0, 0, 1, 0],
  ['基本单位id', 'nvarchar(50)', '基本单位id(金蝶 base_unit_id)', '文本', 'detail', 64, 100, 0, 0, 1, 0],
  ['辅助单位名称', 'nvarchar(50)', '辅助单位名称(金蝶 aux_unit_name;多单位商品才有值)', '文本', 'detail', 65, 100, 0, 0, 0, 1],
  ['辅助单位编码', 'nvarchar(50)', '辅助单位编码(金蝶 aux_unit_number)', '文本', 'detail', 66, 100, 0, 0, 1, 0],
  ['辅助单位id', 'nvarchar(50)', '辅助单位id(金蝶 aux_unit_id)', '文本', 'detail', 67, 100, 0, 0, 1, 0],
  ['换算率', 'nvarchar(50)', '换算率(金蝶 conversion_rate,形如「1 kg = 1000 g」)', '文本', 'detail', 68, 120, 0, 0, 0, 1],
  ['换算系数', 'nvarchar(50)', '换算系数(金蝶 coefficient)', '文本', 'detail', 69, 100, 0, 0, 1, 0],
  ['辅助换算系数', 'nvarchar(50)', '辅助换算系数(金蝶 aux_coefficient)', '文本', 'detail', 71, 110, 0, 0, 1, 0],
  ['数量', 'decimal(18,4)', '数量(金蝶 qty;主单位数量)', '小数', 'detail', 80, 110, 1, 1, 0, 1],
  ['辅助数量', 'decimal(18,4)', '辅助数量(金蝶 aux_qty;多单位商品才有值)', '小数', 'detail', 82, 110, 1, 0, 0, 1],
  ['库存数量', 'nvarchar(50)', '库存数量(金蝶 inv_qty;同族面板惯例存文本)', '文本', 'detail', 84, 100, 0, 0, 0, 1],
  ['单价', 'decimal(18,4)', '单价(业务单价)', '小数', 'detail', 90, 110, 1, 0, 0, 1],
  ['金额', 'decimal(18,4)', '金额', '小数', 'detail', 92, 110, 1, 0, 0, 1],
  // ⚠ 标签必须与表头字段不重名:yj_field 在同一面板内按 label 唯一,表头已有「备注」,
  //   明细分录的那一列按同族面板惯例叫「明细备注」(bl_material_out 同款;col_name 仍是 备注)
  ['明细备注', 'nvarchar(200)', '明细备注(金蝶 comment;列名 备注,标签 明细备注 —— 与表头「备注」区分)', '文本', 'detail', 95, 160, 1, 0, 0, 1],
]

// 类型专属列(按实测:其他入库行有 成本/单位成本/图片 且无批次;其他出库行有批号)
const IN_ONLY_LINE = [
  ['批号', 'nvarchar(50)', '批号(金蝶 batch_no;其他入库实测 0% 有值,但**库存记账要用它做库存键**——与采购入库/产成品入库/其他出库同款,故建列并登记)', '文本', 'query,detail', 96, 120, 1, 0, 0, 1],
  ['成本', 'nvarchar(50)', '成本(金蝶 cost;其他入库实测 19% 行有值)', '文本', 'detail', 100, 100, 0, 0, 0, 1],
  ['单位成本', 'nvarchar(50)', '单位成本(金蝶 unit_cost;其他入库实测 19% 行有值)', '文本', 'detail', 102, 100, 0, 0, 0, 1],
  ['存货图片', 'nvarchar(300)', '存货图片(金蝶 picture;其他入库实测 14% 行有值)', '文本', 'detail', 104, 200, 0, 0, 0, 1],
]
const OUT_ONLY_LINE = [
  ['批号', 'nvarchar(50)', '批号(金蝶 batch_no;其他出库实测 93% 行有值)', '文本', 'query,detail', 100, 120, 1, 0, 0, 1],
]
const IN_ONLY_HEAD = [
  // 供应商:参照 供应商档案 GFDA(口径照抄采购入库单:编码 ref=dm/disp=mc,名称 ref=mc/disp=mc)
  ['供应商编码', 'nvarchar(50)', '供应商编码(金蝶 supplier_number;其他入库实测 100% 有值)', '参照', 'query,header', 50, 140, 1, 0, 0, 1, { ref: 'GFDA', refField: 'dm', disp: 'mc' }],
  ['供应商', 'nvarchar(100)', '供应商(金蝶 supplier_name)', '参照', 'query,header', 52, 160, 1, 0, 0, 1, { ref: 'GFDA', refField: 'mc', disp: 'mc' }],
  // 部门/经手人:金蝶 inv_other_in 有这两个键族(实测非空率 0%),但**面板口径与产成品入库单对齐**要有
  // (用户 2026-10-14:「没有将面板的全部实现与产成品入库对齐」)⇒ 建列并登记为参照;拉取有值即落。
  ['部门', 'nvarchar(50)', '部门(金蝶 dept_name;参照部门档案)', '参照', 'header', 54, 130, 1, 0, 0, 1, { ref: 'DEPT', refField: '部门名称', disp: '部门名称' }],
  ['部门编码', 'nvarchar(50)', '部门编码(金蝶 dept_number;转ERP 推 dept_number)', '参照', 'header', 56, 110, 1, 0, 0, 1, { ref: 'DEPT', refField: '部门编码', disp: '部门名称' }],
  ['经手人', 'nvarchar(50)', '经手人(金蝶 emp_name)', '参照', 'header', 58, 130, 1, 0, 0, 1, { ref: 'EMP', refField: '员工名称', disp: '员工名称' }],
  ['经手人编码', 'nvarchar(50)', '经手人编码(金蝶 emp_number;转ERP 推 emp_number)', '文本', 'header', 59, 110, 1, 0, 0, 1],
]
const OUT_ONLY_HEAD = [
  ['部门', 'nvarchar(50)', '部门(金蝶 dept_name;其他出库实测 97% 有值;参照部门档案)', '参照', 'query,header', 50, 130, 1, 0, 0, 1, { ref: 'DEPT', refField: '部门名称', disp: '部门名称' }],
  ['部门编码', 'nvarchar(50)', '部门编码(金蝶 dept_number;转ERP 推 dept_number)', '参照', 'header', 52, 110, 1, 0, 0, 1, { ref: 'DEPT', refField: '部门编码', disp: '部门名称' }],
  ['经手人', 'nvarchar(50)', '经手人(金蝶 emp_name;其他出库实测 97% 有值)', '参照', 'query,header', 54, 130, 1, 0, 0, 1, { ref: 'EMP', refField: '员工名称', disp: '员工名称' }],
  ['经手人编码', 'nvarchar(50)', '经手人编码(金蝶 emp_number;转ERP 推 emp_number)', '文本', 'header', 56, 110, 1, 0, 0, 1],
]

const SPEC = {
  OTHER_IN: {
    slug: 'other-docs-rebuild-20261014',
    panel: 'OTHER_IN', panelName: '其他入库单', panelNameEn: 'Other inbound delivery notes',
    head: 'bd_other_in', line: 'bl_other_in', prefix: 'OI', kdApi: 'inv_other_in',
    kdLabel: '其他入库单', transTypeId: '12', transTypeNumber: 'QTRKLX01', transTypeName: '其他入库',
    headCols: [...HEAD_SIDE('其他入库'), ...IN_ONLY_HEAD, ...COMMON_HEAD_TAIL],
    lineCols: [...LINE_COLS, ...IN_ONLY_LINE],
    // 明细/统计视图(列名对照 v_purchase_in_detail / v_purchase_in_stats)
    detailView: [
      'h.[单据日期]', 'h.asp_time1 AS [创建时间]', 'h.[单据编号]', 'h.[业务类型]',
      'NULL AS [仓库编码] /* 布局列 */', 'l.[仓库]', 'h.[供应商编码]', 'h.[供应商]',
      'h.[备注]', 'h.asp_user1 AS [制单人]', 's.shr AS [审核人]',
      'l.[存货编码]', 'l.[存货名称] AS [存货]', 'l.[规格型号]', 'l.[计量单位]', 'l.[数量]', 'l.[单价]', 'l.[金额]',
      'l.[辅助单位名称] AS [计量单位2]', 'l.[辅助数量] AS [数量2]', 'l.[库存数量]',
    ],
    statsView: [
      "NULL AS [仓库编码]", 'l.[仓库]', 'h.[供应商编码]', 'h.[供应商]',
      'l.[存货编码]', 'l.[存货名称] AS [存货]', 'l.[规格型号]',
      'l.[计量单位] AS [主单位]', 'l.[辅助单位名称] AS [辅单位]',
      'SUM(COALESCE(l.[数量],0)) AS [数量(主单位)]',
      'SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [单价(主单位)]',
      'SUM(COALESCE(l.[金额],0)) AS [金额]',
      'SUM(COALESCE(l.[辅助数量],0)) AS [数量(辅单位)]',
      'NULL AS [单价(辅单位)]',
    ],
    statsGroup: ['h.asp_cancel', 'l.[仓库]', 'h.[供应商编码]', 'h.[供应商]', 'l.[存货编码]', 'l.[存货名称]', 'l.[规格型号]', 'l.[计量单位]', 'l.[辅助单位名称]'],
  },
}
SPEC.OTHER_OUT = {
  ...SPEC.OTHER_IN,
  panel: 'OTHER_OUT', panelName: '其他出库单', panelNameEn: 'Other delivery notes',
  head: 'bd_other_out', line: 'bl_other_out', prefix: 'OO', kdApi: 'inv_other_out',
  kdLabel: '其他出库单', transTypeId: '13', transTypeNumber: 'QTCKLX01', transTypeName: '其他出库',
  headCols: [...HEAD_SIDE('其他出库'), ...OUT_ONLY_HEAD, ...COMMON_HEAD_TAIL],
  lineCols: [...LINE_COLS, ...OUT_ONLY_LINE],
  detailView: SPEC.OTHER_IN.detailView.map((x) => x.replace('h.[供应商编码]', 'h.[部门编码]').replace('h.[供应商]', 'h.[部门]')).slice(0, 9)
    .concat(['h.[经手人]'])
    .concat(SPEC.OTHER_IN.detailView.slice(9)),
  statsView: SPEC.OTHER_IN.statsView.map((x) => x.replace('h.[供应商编码]', 'h.[部门编码]').replace('h.[供应商]', 'h.[部门]')),
  statsGroup: ['h.asp_cancel', 'l.[仓库]', 'h.[部门编码]', 'h.[部门]', 'l.[存货编码]', 'l.[存货名称]', 'l.[规格型号]', 'l.[计量单位]', 'l.[辅助单位名称]'],
}

const EN = {
  单据日期: 'Document Date', 单据编号: 'Document Number', 业务类型: 'Business Type', 业务类型编码: 'Business Type Code', 业务类型id: 'Business Type ID',
  备注: 'Remark', 创建人: 'Creator', 创建时间: 'Created at', 修改人: 'Modifier', 修改时间: 'Modified at', 审核人: 'Auditor', 审核时间: 'Audit time',
  外部数据ID: 'External ID', 外部单据号: 'External Bill No.', 外部指纹: 'External Fingerprint',
  是否已转ERP: 'Pushed to ERP', ERP单号: 'ERP Bill No.', 转ERP操作人: 'ERP Pushed By', 转ERP时间: 'ERP Pushed At',
  金蝶单据状态: 'Kingdee Bill Status', 金蝶审核人: 'Kingdee Auditor', 金蝶审核时间: 'Kingdee Audit Time',
  序号: 'Seq', 存货编码: 'Item Code', 存货名称: 'Item Name', 规格型号: 'Model', 仓库: 'Warehouse', 仓库编码: 'Warehouse Code',
  计量单位: 'Unit', 基本单位名称: 'Base Unit', 基本单位编码: 'Base Unit Code', 基本单位id: 'Base Unit ID',
  辅助单位名称: 'Aux Unit', 辅助单位编码: 'Aux Unit Code', 辅助单位id: 'Aux Unit ID',
  换算率: 'Conversion Rate', 换算系数: 'Coefficient', 辅助换算系数: 'Aux Coefficient',
  数量: 'Qty', 辅助数量: 'Aux Qty', 库存数量: 'Inventory Qty', 单价: 'Price', 金额: 'Amount',
  成本: 'Cost', 单位成本: 'Unit Cost', 存货图片: 'Item Picture', 批号: 'Batch No.',
  供应商编码: 'Vendor code', 供应商: 'Vendor', 部门: 'Department', 部门编码: 'Department Code', 经手人: 'Person in charge', 经手人编码: 'Handler code',
}

const q = (s) => (s === null || s === undefined ? 'NULL' : `N'${String(s).replace(/'/g, "''")}'`)
/** 只建列、不登记为面板字段的列(参照面板同款:单据状态由 yj_doc_status 派生) */
const NO_FIELD = new Set(['单据状态'])
const col = ([name, type]) => `[${name}] ${type} NULL`
const AUDIT = ['asp_user1 nvarchar(50) NULL', 'asp_time1 datetime2 NULL', 'asp_user2 nvarchar(50) NULL', 'asp_time2 datetime2 NULL', 'asp_cancel char(1) NULL']
const SPARE = Array.from({ length: 20 }, (_, i) => `[备用${i + 1}] nvarchar(100) NULL`)

function build() {
  const L = []
  const P = (s) => L.push(s)
  P('/* ============================================================')
  P('   migrate-other-docs-rebuild-20261014.sql — 2026-10-14')
  P('   其他入库单 / 其他出库单:重建三件套(单据 + 明细表 + 统计表)+ 字段对照金蝶 + 转ERP 支撑列')
  P('')
  P('   由 tools/archive/_gen-other-docs-migration.mjs 生成(勿手改;改规格后重跑生成器)。')
  P('')
  P('   背景(用户 2026-10-14 口径):「其他出库/入库也是一样(同产品入库:补转ERP、字段对照金蝶),')
  P('     详细和统计也要做」——这 6 个面板 + 10 张表 + 8 视图曾于 2026-10-08 整体下架')
  P('     (tools/migrate-drop-extra-docs-pu-req-20261008.sql;回退抓手 tools/archive/_panel-age/_backup-20261008/)')
  P('     本次按**金蝶接口字段**重建,面板编码/单号前缀/模块归属沿用下架前登记(OI/OO、库存核算)。')
  P('')
  P('   字段取舍依据(实测,非推测):')
  P('     · 金蝶字段清单 tools/archive/_dump-out/kingdee-3docs-fields-1014.md')
  P('     · 逐键非空率   tools/archive/_dump-out/kingdee-3docs-fieldfill-1014.md(取样 30 张真实单据)')
  P('       其他入库 表头 48 键(恒空 26)/分录 73 键(恒空 44);其他出库 表头 45 键(恒空 20)/分录 73 键(恒空 52)')
  P('       ⇒ 只登记「有数据」的键 + 链路必需族(转ERP 回写/拉取幂等/金蝶状态);恒空键不登记(用户口径:不要无用数据)。')
  P('     · 保存接口     tools/archive/_dump-out/kingdee-save-inv-other-1014.md · kingdee-transtype-1014.md')
  P('       ⚠ 其他入库/出库保存**必须传 trans_type_id**(单发 number/name/trans_type 均报「请填写"业务类型"」),')
  P('         而金蝶**无业务类型档案接口**(9 条候选路径全 519)⇒ 按账套在 MES 侧配置(真实账套实测 12/13)。')
  P('')
  P('   命名口径对照参照面板:表头/明细/视图列名沿用 bl_purchase_in / bl_material_out /')
  P('     v_purchase_in_detail / v_purchase_in_stats 的词汇(用户口径「显示字段对照采购入库单和销售出库单」)。')
  P('')
  P('   幂等(OBJECT_ID 守卫 + NOT EXISTS + 末尾自检);两账套均执行。')
  P('   ============================================================ */')
  P('SET NOCOUNT ON;')
  P('GO')

  // ① 建表
  for (const [code, s] of Object.entries(SPEC)) {
    P(`-- ① 建表 ${s.head}(${s.panelName} 表头)`)
    P(`IF OBJECT_ID(N'dbo.${s.head}', N'U') IS NULL`)
    P(`CREATE TABLE dbo.${s.head} (`)
    P('    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,')
    P('    ' + s.headCols.map(col).join(',\n    ') + ',')
    P('    ' + AUDIT.join(', ') + ',')
    P('    ' + SPARE.join(', '))
    P(');')
    P('GO')
    P(`-- ① 建表 ${s.line}(${s.panelName} 明细)`)
    P(`IF OBJECT_ID(N'dbo.${s.line}', N'U') IS NULL`)
    P(`CREATE TABLE dbo.${s.line} (`)
    P('    [id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,')
    P('    [单据编号] nvarchar(50) NULL,')
    P('    ' + s.lineCols.map(col).join(',\n    ') + ',')
    P('    ' + AUDIT.join(', ') + ',')
    P('    ' + SPARE.join(', '))
    P(');')
    P('GO')
    P(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_${s.line}_docno' AND object_id = OBJECT_ID(N'dbo.${s.line}'))`)
    P(`    CREATE INDEX ix_${s.line}_docno ON dbo.${s.line}([单据编号]);`)
    P('GO')
    // 防御性补列:表已存在(如上次只跑了部分、或后续在规格里加了新列)时,逐列补齐
    // —— 仓库惯例见 migrate-finish-in-wo-line-20261015.sql「防御性加列」
    P(`-- ①b 防御性补列(${s.head} / ${s.line}:列缺失即补,幂等)`)
    for (const [table, cols, extra] of [[s.head, s.headCols, [['单据日期', 'date']]], [s.line, s.lineCols, [['单据编号', 'nvarchar(50)']]]]) {
      for (const [name, type] of [...extra, ...cols.map((c) => [c[0], c[1]]), ...AUDIT.map((a) => {
        const m = a.match(/^(\S+)\s+(.+?)\s+NULL$/)
        return [m[1], m[2]]
      }), ...SPARE.map((sp) => {
        const m = sp.match(/^\[(.+?)\]\s+(.+?)\s+NULL$/)
        return [m[1], m[2]]
      })]) {
        P(`IF COL_LENGTH(N'dbo.${table}', N'${name}') IS NULL ALTER TABLE dbo.${table} ADD [${name}] ${type} NULL;`)
      }
    }
    P('GO')
  }

  // ② 表级 + 列级中文注明
  for (const s of Object.values(SPEC)) {
    P(`-- ② 中文注明(${s.head} / ${s.line})`)
    P(`IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.${s.head}') AND ep.minor_id=0 AND ep.name=N'MS_Description')`)
    P(`    EXEC sp_addextendedproperty N'MS_Description', N'${s.panelName}表头(金蝶 ${s.kdApi} 镜像;2026-10-08 下架后于 2026-10-14 按金蝶字段重建)', N'SCHEMA', N'dbo', N'TABLE', N'${s.head}';`)
    P(`IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.${s.line}') AND ep.minor_id=0 AND ep.name=N'MS_Description')`)
    P(`    EXEC sp_addextendedproperty N'MS_Description', N'${s.panelName}明细(金蝶 ${s.kdApi} 分录镜像)', N'SCHEMA', N'dbo', N'TABLE', N'${s.line}';`)
    P('GO')
    for (const [table, cols] of [[s.head, s.headCols], [s.line, s.lineCols]]) {
      for (const [name, , comment] of cols) {
        P(`IF COL_LENGTH(N'dbo.${table}', N'${name}') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.${table}') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.${table}'), N'${name}', 'ColumnId') AND ep.name=N'MS_Description')`)
        P(`    EXEC sp_addextendedproperty N'MS_Description', ${q(comment)}, N'SCHEMA', N'dbo', N'TABLE', N'${table}', N'COLUMN', N'${name}';`)
      }
    }
    P('GO')
    // 审计四件套 + 单据编号 注明
    for (const [table, extra] of [[s.head, ['单据编号', '单据日期']], [s.line, ['单据编号']]]) {
      for (const name of [...extra, 'asp_user1', 'asp_time1', 'asp_user2', 'asp_time2', 'asp_cancel']) {
        const cmt = { asp_user1: '制单人(审计四件套)', asp_time1: '制单时间(审计四件套;明细/统计视图的「创建时间/制单人」取此列)', asp_user2: '修改人(审计四件套)', asp_time2: '修改时间(审计四件套)', asp_cancel: '作废标记(Y=已作废)' }[name]
          || (name === '单据编号' ? '单据编号(MES 单号)' : '单据日期')
        P(`IF COL_LENGTH(N'dbo.${table}', N'${name}') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.class=1 AND ep.major_id=OBJECT_ID(N'dbo.${table}') AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.${table}'), N'${name}', 'ColumnId') AND ep.name=N'MS_Description')`)
        P(`    EXEC sp_addextendedproperty N'MS_Description', ${q(cmt)}, N'SCHEMA', N'dbo', N'TABLE', N'${table}', N'COLUMN', N'${name}';`)
      }
    }
    P('GO')
  }

  // ③ 视图(明细 + 统计)
  for (const s of Object.values(SPEC)) {
    const fmt = (name) => (name.startsWith('h.') || name.startsWith('l.') || name.startsWith('s.') || name.startsWith('NULL') || name.startsWith('SUM') ? name : `l.[${name}]`)
    P(`-- ③ 视图 v_${s.head.replace('bd_', '')}_detail / _stats`)
    P('GO')
    P(`CREATE OR ALTER VIEW v_${s.head.replace('bd_', '')}_detail AS`)
    P(`SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel,`)
    P('  ' + s.detailView.join(', ') + ',')
    P(`  h.[业务类型编码]`)
    P(`FROM ${s.head} h LEFT JOIN ${s.line} l ON h.[单据编号]=l.[单据编号]`)
    P(`LEFT JOIN yj_doc_status s ON s.panel_code='${s.panel}' AND s.doc_no=h.[单据编号];`)
    P('GO')
    P(`CREATE OR ALTER VIEW v_${s.head.replace('bd_', '')}_stats AS`)
    // ⚠ 必须带 asp_cancel:DbNormAudit 第 13 项「面板引用对象缺 pk_col / asp_cancel(打开即 500)」会 FAIL
    //   (参照 v_purchase_in_stats / v_material_out_stats 都是 id + asp_cancel 打头)
    P(`SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel,`)
    P('  ' + s.statsView.join(', '))
    P(`FROM ${s.head} h LEFT JOIN ${s.line} l ON h.[单据编号]=l.[单据编号]`)
    P(`WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='${s.panel}' AND s.doc_no=h.[单据编号] AND s.canceled='Y')`)
    P(`GROUP BY ${s.statsGroup.join(', ')};`)
    P('GO')
  }

  // ④ 面板(6 个)
  const panelRow = (code, name, nameEn, mode, head, line, module) =>
    `IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='${code}')\n` +
    `    INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)\n` +
    `    VALUES ('${code}', ${q(name)}, N'${mode === 'doc' ? '库存核算' : '报表'}', N'${mode}', ${line ? q(line) : 'NULL'}, ${head ? q(head) : 'NULL'}, ${head ? 'N\'单据编号\'' : 'NULL'}, N'id', ${head ? 'N\'单据编号\'' : 'NULL'}, ${head ? q(SPEC[code.replace(/_DETAIL|_STATS/, '')].prefix) : 'NULL'}, ${head ? 'N\'单据日期\'' : 'NULL'}, 50, N'items', N'库存核算', ${q(nameEn)});`
  P('-- ④ 面板登记(6 个:单据 + 明细表 + 统计表 × 2)')
  for (const s of Object.values(SPEC)) {
    const base = s.head.replace('bd_', '')
    P(panelRow(s.panel, s.panelName, s.panelNameEn, 'doc', s.head, s.line))
    P('GO')
    P(panelRow(`${s.panel}_DETAIL`, `${s.panelName}明细表`, s.panel.kdNameEnDetail || '', 'flat', null, `v_${base}_detail`))
    P('GO')
    P(panelRow(`${s.panel}_STATS`, `${s.panelName}统计表`, '', 'flat', null, `v_${base}_stats`))
    P('GO')
  }

  // ⑤ 字段登记
  /** 取数口径(第 12 项):{dict} 下拉候选 / {ref,refField,disp} 参照源 —— 直接落进 yj_field 的四列 */
  const wiring = (t) => {
    const w = t[11] || {}
    return {
      dict: w.dict ? q(w.dict) : 'NULL',
      ref: w.ref ? q(w.ref) : 'NULL',
      refField: w.refField ? q(w.refField) : 'NULL',
      disp: w.disp ? q(w.disp) : 'NULL',
    }
  }
  for (const s of Object.values(SPEC)) {
    P(`-- ⑤ 字段登记(${s.panel} 表头 + 明细)`)
    for (const t of s.headCols) {
      const [name, , , dt, place, seq, width, editable, required, hidden, visible] = t
      if (NO_FIELD.has(name)) continue
      const w = wiring(t)
      P(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${s.panel}' AND label=${q(name)})`)
      P(`    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)`)
      P(`    VALUES ('${s.panel}', ${q(name)}, ${q(name)}, ${q(dt)}, ${w.dict}, ${w.ref}, ${w.refField}, ${w.disp}, ${q(place)}, ${seq}, ${width}, ${editable}, ${required}, ${hidden}, NULL, ${visible});`)
    }
    P('GO')
    for (const t of s.lineCols) {
      const [name, , , dt, place, seq, width, editable, required, hidden, visible] = t
      const w = wiring(t)
      P(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${s.panel}' AND label=${q(name)})`)
      P(`    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)`)
      P(`    VALUES ('${s.panel}', ${q(name)}, ${q(name)}, ${q(dt)}, ${w.dict}, ${w.ref}, ${w.refField}, ${w.disp}, ${q(place)}, ${seq}, ${width}, ${editable}, ${required}, ${hidden}, NULL, ${visible});`)
    }
    P('GO')
    // ⑤b 对齐既有登记(2026-10-14 用户反馈「没有下拉数据下来」):早先这批字段是按**纯文本**登记的,
    //   生成器的 INSERT 有 NOT EXISTS 守卫 ⇒ 不会再改既有行。故这里逐字段 UPDATE 成参照/下拉口径
    //   (窄条件:同面板 + 同标签 + 当前类型不符才改),并同步 place/seq/宽/可编辑 —— 与参照面板一致。
    P(`-- ⑤b 既有字段口径对齐(${s.panel}:文本 → 参照/下拉,口径照抄采购入库单/销售出库单)`)
    for (const t of [...s.headCols, ...s.lineCols]) {
      const [name, , , dt, place, seq, width, editable, required, hidden, visible] = t
      if (NO_FIELD.has(name)) continue
      const w = wiring(t)
      if (w.dict === 'NULL' && w.ref === 'NULL') continue
      P(`UPDATE yj_field SET data_type = ${q(dt)}, dict_sql = ${w.dict}, ref_panel = ${w.ref}, ref_field = ${w.refField}, display_field = ${w.disp},`
        + ` place = ${q(place)}, seq = ${seq}, width = ${width}, editable = ${editable}, required = ${required}, hidden = ${hidden}, visible = ${visible}`
        + ` WHERE panel_code = '${s.panel}' AND label = ${q(name)} AND (data_type <> ${q(dt)} OR ISNULL(ref_panel,'') <> ${w.ref === 'NULL' ? "''" : w.ref} OR ISNULL(dict_sql,'') <> ${w.dict === 'NULL' ? "''" : w.dict});`)
    }
    P('GO')
    // 明细/统计面板字段(视图列)
    const flatCols = [...new Set([...s.detailView, ...s.statsView].map((x) => {
      const m = x.match(/AS \[([^\]]+)\]/)
      if (m) return m[1]
      const m2 = x.match(/^[hl]\.\[([^\]]+)\]$/)
      if (m2) return m2[1]
      return null
    }).filter(Boolean))]
    for (const [suffix, cols] of [['DETAIL', s.detailView], ['STATS', s.statsView]]) {
      const labels = cols.map((x) => {
        const m = x.match(/AS \[([^\]]+)\]/); if (m) return m[1]
        const m2 = x.match(/^[hl]\.\[([^\]]+)\]$/); if (m2) return m2[1]
        return null
      }).filter(Boolean)
      P(`-- ⑤ 字段登记(${s.panel}_${suffix} ${labels.length} 列)`)
      let seq = 10
      for (const lb of labels) {
        P(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${s.panel}_${suffix}' AND label=${q(lb)})`)
        P(`    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible)`)
        P(`    VALUES ('${s.panel}_${suffix}', ${q(lb)}, ${q(lb)}, N'文本', NULL, NULL, NULL, NULL, N'detail', ${seq}, 120, 0, 0, 0, NULL, 1);`)
        seq += 10
      }
      P('GO')
    }
  }

  // ⑥ 译名(面板名 + 字段标签)
  P('-- ⑥ 译名(面板名 + 字段标签 en)')
  for (const s of Object.values(SPEC)) {
    P(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=${q(s.panelName)} AND locale='en')`)
    P(`    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', ${q(s.panelName)}, 'en', ${q(s.panelNameEn)}, 'manual');`)
    for (const nm of [`${s.panelName}明细表`, `${s.panelName}统计表`]) {
      const en = nm.endsWith('明细表') ? `${s.panelNameEn.replace(/s$/, '')} Details` : `${s.panelNameEn.replace(/s$/, '')} Summary`
      P(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=${q(nm)} AND locale='en')`)
      P(`    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', ${q(nm)}, 'en', ${q(en)}, 'manual');`)
    }
  }
  for (const [label, en] of Object.entries(EN)) {
    P(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=${q(label)} AND locale='en')`)
    P(`    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', ${q(label)}, 'en', ${q(en)}, 'manual');`)
  }
  P('GO')

  // ⑦ 角色授权(沿用下架前:role 1..4 全权限)
  P('-- ⑦ 角色授权(沿用下架前登记:admin/user/rd_file_owner/rd_review 四角色 view,query,add,modify,modlog,del,export)')
  for (const s of Object.values(SPEC)) {
    for (const code of [s.panel, `${s.panel}_DETAIL`, `${s.panel}_STATS`]) {
      for (const rid of [1, 2, 3, 4]) {
        P(`IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id=${rid} AND panel_code='${code}')`)
        P(`    INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (${rid}, '${code}', 'N', 'view,query,add,modify,modlog,del,export');`)
      }
    }
  }
  P('GO')

  // ⑧ 自检
  P('-- ⑧ 自检:表/视图/面板/字段/译名/授权 齐备(缺一即失败)')
  P('DECLARE @bad int = 0;')
  for (const s of Object.values(SPEC)) {
    for (const t of [s.head, s.line]) P(`IF OBJECT_ID(N'dbo.${t}', N'U') IS NULL SET @bad = @bad + 1;`)
    for (const v of [`v_${s.head.replace('bd_', '')}_detail`, `v_${s.head.replace('bd_', '')}_stats`]) P(`IF OBJECT_ID(N'dbo.${v}', N'V') IS NULL SET @bad = @bad + 1;`)
    for (const c of [s.panel, `${s.panel}_DETAIL`, `${s.panel}_STATS`]) P(`IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='${c}') SET @bad = @bad + 1;`)
    const fieldCnt = s.headCols.filter((c) => !NO_FIELD.has(c[0])).length + s.lineCols.length
    P(`IF (SELECT COUNT(*) FROM yj_field WHERE panel_code='${s.panel}') < ${fieldCnt} SET @bad = @bad + 1;`)
    P(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=${q(s.panelName)} AND locale='en') SET @bad = @bad + 1;`)
    P(`IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE panel_code='${s.panel}' AND role_id=1) SET @bad = @bad + 1;`)
    P(`IF COL_LENGTH(N'dbo.${s.head}', N'业务类型id') IS NULL SET @bad = @bad + 1;`)
  }
  P(`IF @bad > 0 RAISERROR(N'其他入库/出库三件套自检失败(%d 项缺失)', 16, 1, @bad);`)
  P(`ELSE PRINT N'其他入库/出库三件套就绪(表 4 / 视图 4 / 面板 6 / 字段 / 译名 / 授权;幂等)';`)
  P('GO')
  return L.join('\n') + '\n'
}

const sql = build()
writeFileSync(new URL('../migrate-other-docs-rebuild-20261014.sql', import.meta.url), sql, 'utf8')
console.log(`生成 tools/migrate-other-docs-rebuild-20261014.sql (${sql.split('\n').length} 行)`)
for (const s of Object.values(SPEC)) console.log(`  ${s.panel}: 表头 ${s.headCols.length} 列 / 明细 ${s.lineCols.length} 列 / 明细视图 ${s.detailView.length} 列 / 统计视图 ${s.statsView.length} 列`)

