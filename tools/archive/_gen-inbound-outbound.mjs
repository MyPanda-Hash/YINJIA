// 生成器:采购入库(PURCHASE_IN)/销售出库(SALE_OUT)面板字段与接口并集完全对应
//   只产出 列+面板字段+译名+EXTRA/EXTRA_LINES 映射数据;不改 sync-core(用户后面有同步脚本特殊要求)
// 标签来源:探针实测 JSON + 订单已验证的 LABEL_OVERRIDE(API 字段名高度重用)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const api = JSON.parse(readFileSync(join(HERE, '_inbound-outbound-fields.json'), 'utf8'));

// 现有物理列(订单头/行表已含;这里补 bd_purchase_in/bl_purchase_in/bd_sale_out/bl_sale_out)
const existCols = new Map();
for (const line of readFileSync(join(HERE, '_q15-cols.out'), 'utf8').split(/\r?\n/)) {
  if (!line.includes('|')) continue;
  const [t, c] = line.split('|');
  if (!existCols.has(t)) existCols.set(t, new Set());
  existCols.get(t).add(c);
}
// 现有面板字段
const panelCols = new Map();
for (const line of readFileSync(join(HERE, '_panel-fields.out'), 'utf8').split(/\r?\n/)) {
  const [p, c] = line.split('|');
  if (!p || !c || p === 'panel_code') continue;
  if (!panelCols.has(p)) panelCols.set(p, new Set());
  panelCols.get(p).add(c);
}

// 现有 MES 字段 → API 键 对应(这些不需要重复加,同步时直接映射)
const MAPPED = {
  PURCHASE_IN: ['bill_no', 'bill_date', 'supplier_name', 'supplier_number', 'exchange_rate', 'emp_name', 'bill_stock_name', 'remark',
    // 行
    'material_name', 'material_number', 'material_model', 'qty', 'unit_name', 'price', 'cess', 'tax_price', 'amount', 'all_amount',
    'batch_no', 'inv_qty', 'aux_qty', 'aux_unit_name', 'comment', 'delivery_date', 'picture'],
  SALE_OUT: ['bill_no', 'bill_date', 'customer_name', 'customer_number', 'exchange_rate', 'emp_name', 'bill_stock_name', 'remark',
    'material_name', 'material_number', 'material_model', 'qty', 'unit_name', 'price', 'cess', 'tax_price', 'amount', 'all_amount',
    'batch_no', 'inv_qty', 'aux_qty', 'aux_unit_name', 'comment', 'delivery_date', 'picture'],
};

const LABEL = {
  // 头(订单共用)
  bill_status: '单据状态', bill_close_state: '单据关闭状态', create_time: '创建时间', modify_time: '修改时间', audit_time: '审核时间',
  creator_name: '创建人', modifier_name: '修改人', auditor_name: '审核人', trans_type: '交易类型', dept_name: '部门', dept_number: '部门编码',
  contact_phone: '联系人电话', contact_address: '联系地址', dispatcher_linkman: '发货人', dispatcher_phone: '发货电话', dispatcher_address: '发货地址',
  settle_status: '结算状态', total_amount: '金额', due_date: '到期日', setting_term_name: '结算期限', setting_term_number: '结算期限编码',
  bill_dis_amount: '整单折扣额', bill_dis_rate: '整单折扣率%', currency_id: '币种id', all_debt: '应收款余额', last_debt: '上次欠款',
  total_unsettle_amount: '未结算金额', total_ins_amount: '保险金额', total_pre_amount: '预付金额', delivery_type_name: '交货方式',
  edit_pay_type_name: '付款方式', edit_pay_account_name: '付款账户', cost_fee_entity: '采购费用分录', payment_entry: '付款信息分录',
  attachments_url: '附件地址', bill_stock_name: '仓库', bill_stock_number: '仓库编码', bill_sp_name: '仓位', bill_sp_number: '仓位编码',
  customer_name: '客户', customer_number: '客户编码', supplier_name: '供应商', supplier_number: '供应商编码',
  // 行(订单共用)
  material_id: '商品id', stock_id: '仓库id', stock_name: '仓库名称', stock_number: '仓库编码', sp_id: '仓位id', sp_name: '仓库名称', sp_number: '仓位编码',
  base_unit_id: '基本单位id', base_unit_name: '基本单位名称', base_unit_number: '基本单位编码', unit_id: '单位id', unit_number: '单位编码',
  aux_unit_id: '辅助单位id', aux_unit_number: '辅助单位编码', aux_coefficient: '辅助换算系数',
  aux_prop_id: '辅助属性id', aux_prop_name: '辅助属性名称', aux_prop_number: '辅助属性编码',
  aux_id1: '辅助属性1id', aux_name1: '辅助属性1名称', aux_number1: '辅助属性1编码',
  aux_id2: '辅助属性2id', aux_name2: '辅助属性2名称', aux_number2: '辅助属性2编码',
  aux_id3: '辅助属性3id', aux_name3: '辅助属性3名称', aux_number3: '辅助属性3编码',
  barcode: '条形码', coefficient: '换算系数', conversion_rate: '换算率', tax_amount: '税额', discount: '折扣额',
  fee: '费用', dis_rate: '折扣率%', dis_amount: '折扣金额', dis_price: '折后单价', pre_dis_amount: '折前金额',
  act_non_tax_amount: '实际不含税金额', unit_cost: '单位成本', cost: '成本', cur_settle_amount: '本次结算金额',
  pro_place: '产地', pro_reg_no: '注册证号', pro_license: '生产许可证', kf_date: '保质期到期日', valid_date: '有效期至',
  kf_type: '保质期类型', kf_period: '保质期', sn_list: '序列号清单', sn_list_id: '序列号流转ID', seq: '行号',
  entry_status: '分录状态', entry_settle_status: '分录结算状态', is_free: '是否赠品',
  src_order_id: '源单id', src_bill_no: '源单编号', src_bill_type_id: '源单类型id', src_bill_type_name: '源单类型名称',
  src_bill_type_number: '源单类型编码', src_inter_id: '源单内部id', src_bill_date: '源单日期', src_seq: '源单行号', src_entry_id: '源单分录id',
  base_qty: '基本数量', cus_bill_no: '客户单号', dis_tax_amount: '折扣税额',
  material_is_multi_unit: '商品是否多单位', material_is_serial: '商品是否序列号', material_is_asst_attr: '商品是否辅助属性',
  material_is_batch: '商品是否批次', material_is_kf_period: '商品是否保质期', material_help_code: '商品助记码',
  return_qty: '退货数量', return_qty_unit: '退货单位', inv_base_qty: '库存基本数量', divide_diff_amount: '分摊差额',
  bill_dis_distribution: '整单折扣分摊', outside_material_number: '外部商品编码', outside_material_unit: '外部商品单位',
  // 入库/出库特有
  in_qty: '入库数量', close_state: '分录关闭状态', entry_realio_status: '分录出入库状态', entry_ios_tatus: '分录出入库状态2',
  all_amount_for: '价税合计本位币', entry_un_ivc_qty: '未开票数量', entry_ivc_qty: '已开票数量',
  entry_ivc_amount: '已开票金额', entry_un_ivc_amount: '未开票金额',
  // 出库物流子表
  express_entity: '物流信息分录',
  match_source_no: '匹配来源单号', supp_material_number: '供应商商品编码', supp_material_name: '供应商商品名称',
  // 补全(第一轮英文标签修正)
  emp_number: '经手人编码', delivery_type_number: '交货方式编码', contact_country_name: '联系人国家名称',
  contact_country_number: '联系人国家编码', contact_province_name: '联系人省份名称', contact_province_number: '联系人省份编码',
  contact_city_name: '联系人市区名称', contact_city_number: '联系人市区编码', contact_district_name: '联系人区县名称',
  contact_district_number: '联系人区县编码', contact_linkman: '联系人', contact_info: '联系信息',
  dispatcher_country_name: '发货国家名称', dispatcher_country_number: '发货国家编码',
  dispatcher_province_name: '发货省份名称', dispatcher_province_number: '发货省份编码',
  dispatcher_city_name: '发货市区名称', dispatcher_city_number: '发货市区编码',
  dispatcher_district_name: '发货区县名称', dispatcher_district_number: '发货区县编码',
  stock_is_allow_freight: '仓库启用仓位管理', def_float_qty: '默认浮动数量',
  cost_view: '成本视图', unit_cost_view: '单位成本视图', material_entity: '商品分录',
  delivery_status: '发货状态', material_group: '商品组合', material_qty: '商品数量',
  bill_dis_before_amount: '折前价税合计', ivc_status: '开票状态', recevice_delivery: '发货方式',
  deduction_balance: '抵扣余额', total_un_settle_amount: '未结算金额', cost_fee: '采购费用',
  subsist_info: '费用分摊信息', io_status: '出入库状态', mulbill_label: '单据标签',
  cus_bear_fee_entry: '客户承担费用分录', vrp_entity: '配送路线分录', currency_name: '币别名称',
  aux_id4: '辅助属性4id', aux_name4: '辅助属性4名称', aux_number4: '辅助属性4编码',
  aux_id5: '辅助属性5id', aux_name5: '辅助属性5名称', aux_number5: '辅助属性5编码',
  act_tax_price: '实际含税单价', bill_stock_number: '仓库编码', total_amount_for: '金额本位币',
};
const SENS = /phone|mobile|email|bank_account|birthday|qq|wechat|id_number|address|contact_info|contact_phone/;
const NUM = /qty|amount|price|rate|cost|coefficient|fee|seq|discount|period|count/i;
const humanize = (k) => k.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// 默认隐藏的键(id/创建修改/附件/费用分录/物流子表)
const HIDE = /_id$|creator|modifier|auditor_id|auditor_number|attachments|cost_fee_entity|payment_entry|express_entity|custom_field|^id$|_for$|edit_pay/;

const PANEL = { PUR_IN: 'PURCHASE_IN', SALE_OUT: 'SALE_OUT' };
const HEAD_TABLE = { PUR_IN: 'bd_purchase_in', SALE_OUT: 'bd_sale_out' };
const LINE_TABLE = { PUR_IN: 'bl_purchase_in', SALE_OUT: 'bl_sale_out' };

const sql = [];
sql.push('-- migrate-inbound-outbound-fields.sql — 采购入库/销售出库面板字段与接口并集对应(不含同步脚本)');
sql.push('-- 生成器:tools/archive/_gen-inbound-outbound.mjs(标签=订单已验证覆盖表;默认隐藏 id/创建修改/附件/费用分录)');
sql.push('USE HSDZ_MES;');
sql.push('SET NOCOUNT ON;');
sql.push('GO');
sql.push('');

const EXTRA_NEW = { PURCHASE_IN: [], SALE_OUT: [] };
const EXTRA_LINES_NEW = { PURCHASE_IN: [], SALE_OUT: [] };
const report = [];

for (const [code, panel] of Object.entries(PANEL)) {
  const rec = api[code];
  if (!rec) continue;
  const union = new Set([...(rec.listKeys || []), ...(rec.detailKeys || [])]);
  const mappedApi = new Set(MAPPED[panel] || []);
  const lineKeys = rec.sub_material_entity_keys || [];
  const headDelta = [...union].filter((k) => !mappedApi.has(k) && !['id', 'custom_field'].includes(k));
  // 行:现有面板行的 MES 字段对应的 API 键在 MAPPED 里
  const lineDelta = lineKeys.filter((k) => !mappedApi.has(k) && !['id', 'custom_entity_field'].includes(k)
    // 跳过对象型 custom_entity_field
  );
  const ht = HEAD_TABLE[code], lt = LINE_TABLE[code];
  const hExist = existCols.get(ht) || new Set();
  const lExist = existCols.get(lt) || new Set();
  const hPanel = panelCols.get(panel) || new Set();
  const hUsed = new Set([...hExist, ...hPanel]);
  const lUsed = new Set([...lExist]);
  const stmts = [];

  // 头字段
  for (const k of headDelta) {
    const t = SENS.test(k) ? 'dec' : 'str';
    let label = LABEL[k] || k;
    if (hUsed.has(label)) label = `${label}_${k}`;
    hUsed.add(label);
    EXTRA_NEW[panel].push({ c: label, a: k, t });
    const hide = HIDE.test(k) ? 1 : 0;
    stmts.push(`IF COL_LENGTH('dbo.${ht}', N'${label}') IS NULL ALTER TABLE dbo.${ht} ADD [${label}] nvarchar(500) NULL;`);
    stmts.push(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${panel}' AND col_name=N'${label}')`);
    stmts.push(`    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('${panel}', N'${label}', N'${label}', N'文本', N'header', 970, 130, 1, 0, ${hide}, ${1 - hide});`);
    stmts.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'${label}' AND locale='en')`);
    stmts.push(`    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'${label}', 'en', N'${humanize(k)}', 'manual');`);
  }
  // 行字段
  for (const k of lineDelta) {
    const t = SENS.test(k) ? 'dec' : NUM.test(k) ? 'num' : 'str';
    let label = LABEL[k] || k;
    if (lUsed.has(label)) label = `${label}_${k}`;
    lUsed.add(label);
    EXTRA_LINES_NEW[panel].push({ c: label, a: k, t });
    const hide = HIDE.test(k) ? 1 : 0;
    stmts.push(`IF COL_LENGTH('dbo.${lt}', N'${label}') IS NULL ALTER TABLE dbo.${lt} ADD [${label}] nvarchar(500) NULL;`);
    stmts.push(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${panel}' AND col_name=N'${label}')`);
    stmts.push(`    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('${panel}', N'${label}', N'${label}', N'文本', N'detail', 970, 120, 1, 0, ${hide}, ${1 - hide});`);
    stmts.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'${label}' AND locale='en')`);
    stmts.push(`    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'${label}', 'en', N'${humanize(k)}', 'manual');`);
  }
  report.push(`${panel}:头并集 ${union.size}(已对应 ${mappedApi.size},补 ${headDelta.length}) | 行子键 ${lineKeys.length}(补 ${lineDelta.length})`);
  if (stmts.length) sql.push(`-- ══ ${panel}(${code}):头补 ${headDelta.length} 行补 ${lineDelta.length} ══`, ...stmts, 'GO', '');
}
sql.push("PRINT N'migrate-inbound-outbound-fields 完成';");
sql.push('GO');
writeFileSync(join(HERE, '..', 'migrate-inbound-outbound-fields.sql'), sql.join('\n'), 'utf8');
// EXTRA 追加(不含同步接线;数据备好待用户同步脚本要求)
const cur = readFileSync(join(HERE, '..', '..', 'deploy', 'kingdee-extra-fields.mjs'), 'utf8');
const extraMatch = cur.match(/export const EXTRA = (\{[\s\S]*?\n\});/);
const linesMatch = cur.match(/export const EXTRA_LINES = (\{[\s\S]*?\n\});/);
const curExtra = JSON.parse(extraMatch[1]);
const curLines = JSON.parse(linesMatch[1]);
for (const [p, list] of Object.entries(EXTRA_NEW)) if (list.length) curExtra[p] = list;
for (const [p, list] of Object.entries(EXTRA_LINES_NEW)) if (list.length) curLines[p] = list;
const js = [
  '// kingdee-extra-fields.mjs — 全并集自动映射表(生成器产出,勿手改)',
  '//   EXTRA: 头/档案级 c=列 a=接口键(支持 dotted) t=dec/join/str',
  '//   EXTRA_LINES: 单据行级(键取自 material_entity 元素)',
  '//   注意:PURCHASE_IN/SALE_OUT 的条目已备好但 sync-core 尚未接入(待同步脚本特殊要求)',
  `export const EXTRA = ${JSON.stringify(curExtra, null, 2)};`,
  '',
  `export const EXTRA_LINES = ${JSON.stringify(curLines, null, 2)};`,
  '',
].join('\n');
writeFileSync(join(HERE, '..', '..', 'deploy', 'kingdee-extra-fields.mjs'), js, 'utf8');
console.log(report.join('\n'));
console.log('\n已生成: migrate-inbound-outbound-fields.sql + EXTRA/EXTRA_LINES 追加(未接同步)');
