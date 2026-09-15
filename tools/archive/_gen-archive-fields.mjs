// 生成器:按真实接口字段补齐 12 类档案的 MES 列 + yj_field + 译名 → 输出幂等迁移 SQL
// 用法:node tools/archive/_gen-archive-fields.mjs > tools/migrate-kingdee-archive-fields.sql
// 口径:①档 = 接口返回且非敏感、非纯 id 的字段;②敏感密文(bank_account/addr/tel/mobile/email/birthday/qq/wechat/证件号)不落;
//      ③接口不提供的字段(客户洞察/标签/来源/禁用人等)不做。
// 列名:新列一律中文(与 bs_*/bd_* 一致),旧表拼音列保持不动。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// spec: [档案码, 表, 列名, 中文标签, 类型, 接口键(支持 a.b 取子对象/数组首元素), 面板 place]
const SPEC = [
  // ── 商品分类 ──
  ['BD_MATGRP', 'bs_material_group', '创建时间', '创建时间', 'datetime2', 'create_time', 'detail'],
  ['BD_MATGRP', 'bs_material_group', '修改时间', '修改时间', 'datetime2', 'modify_time', 'detail'],
  // ── 币别 ──
  ['BD_CUR', 'bs_currency', '创建人', '创建人', 'nvarchar(100)', 'creator_name', 'detail'],
  ['BD_CUR', 'bs_currency', '创建时间', '创建时间', 'datetime2', 'create_time', 'detail'],
  ['BD_CUR', 'bs_currency', '修改人', '修改人', 'nvarchar(100)', 'modifier_name', 'detail'],
  ['BD_CUR', 'bs_currency', '修改时间', '修改时间', 'datetime2', 'modify_time', 'detail'],
  // ── 计量单位 ──
  ['BD_UOM', 'bs_uom', '长编码', '长编码', 'nvarchar(100)', 'long_number', 'detail'],
  ['BD_UOM', 'bs_uom', '精度处理', '精度处理', 'int', 'precision_account', 'detail'],
  ['BD_UOM', 'bs_uom', '是否叶子节点', '是否叶子节点', 'bit', 'is_leaf', 'detail'],
  ['BD_UOM', 'bs_uom', '级次', '级次', 'int', 'level', 'detail'],
  ['BD_UOM', 'bs_uom', '创建时间', '创建时间', 'datetime2', 'create_time', 'detail'],
  ['BD_UOM', 'bs_uom', '修改时间', '修改时间', 'datetime2', 'modify_time', 'detail'],
  // ── 部门 ──
  ['BD_DEPT', 'bs_dept', '级次', '级次', 'nvarchar(20)', 'level', 'detail'],
  ['BD_DEPT', 'bs_dept', '长编码', '长编码', 'nvarchar(100)', 'long_number', 'detail'],
  ['BD_DEPT', 'bs_dept', '部门全称', '部门全称', 'nvarchar(200)', 'full_name', 'detail'],
  ['BD_DEPT', 'bs_dept', '上级编码', '上级编码', 'nvarchar(100)', 'parent_number', 'detail'],
  // ── 职员 ──
  ['BD_EMP', 'bs_emp', '性别', '性别', 'nvarchar(10)', 'gender', 'detail'],
  ['BD_EMP', 'bs_emp', '部门编码', '部门编码', 'nvarchar(100)', 'department_number', 'detail'],
  ['BD_EMP', 'bs_emp', '入职日期', '入职日期', 'nvarchar(30)', 'hire_date', 'detail'],
  ['BD_EMP', 'bs_emp', '离职日期', '离职日期', 'nvarchar(30)', 'leave_date', 'detail'],
  // ── 仓库 ──
  ['BD_STORE', 'bs_wh', '国家', '国家', 'nvarchar(100)', 'country_name', 'detail'],
  ['BD_STORE', 'bs_wh', '省', '省', 'nvarchar(100)', 'province_name', 'detail'],
  ['BD_STORE', 'bs_wh', '市', '市', 'nvarchar(100)', 'city_name', 'detail'],
  ['BD_STORE', 'bs_wh', '区', '区', 'nvarchar(100)', 'district_name', 'detail'],
  ['BD_STORE', 'bs_wh', '启用仓位管理', '启用仓位管理', 'bit', 'is_allow_freight', 'detail'],
  ['BD_STORE', 'bs_wh', '仓库管理员编码', '仓库管理员编码', 'nvarchar(100)', 'storekeeper_number', 'detail'],
  // ── 供应商 ──
  ['BD_SUPPLIER', 'dm_gf', '采购员部门', '采购员部门', 'nvarchar(200)', 'sale_dept_name', 'detail'],
  ['BD_SUPPLIER', 'dm_gf', '自动抵扣预收款', '自动抵扣预收款', 'bit', 'deduct', 'detail'],
  // ── 商品(主体)──
  ['BD_MATERIAL', 'bs_inv', '备注', '备注', 'nvarchar(500)', 'remark', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '助记码', '助记码', 'nvarchar(100)', 'help_code', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '产地', '产地', 'nvarchar(200)', 'producing_pace', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '商品类型', '商品类型', 'nvarchar(20)', 'check_type', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '是否可销售', '是否可销售', 'bit', 'is_sale', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '是否可采购', '是否可采购', 'bit', 'is_purchase', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '是否为子件', '是否为子件', 'bit', 'is_subpart', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '是否为组件', '是否为组件', 'bit', 'is_assembly', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '是否多单位', '是否多单位', 'bit', 'is_multi_unit', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '辅助单位', '辅助单位', 'nvarchar(100)', 'aux_unit_name', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '辅助单位编码', '辅助单位编码', 'nvarchar(100)', 'aux_unit_number', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '是否启用保质期', '是否启用保质期', 'bit', 'is_kf_period', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '保质期', '保质期', 'decimal(18,4)', 'kf_period', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '保质期单位', '保质期单位', 'nvarchar(10)', 'kf_period_type', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '预警天数', '预警天数', 'decimal(18,4)', 'alarm_day', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '是否启用辅助属性', '是否启用辅助属性', 'bit', 'is_asst_attr', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '库存管理方式', '库存管理方式', 'nvarchar(20)', 'inv_mgr_type', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '最低库存', '最低库存', 'decimal(18,4)', 'min_inventory_qty', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '最高库存', '最高库存', 'decimal(18,4)', 'max_inventory_qty', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '预警库存', '预警库存', 'decimal(18,4)', 'sec_inventory_qty', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '销项税率', '销项税率', 'decimal(18,4)', 'tax_rate', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '进项税率', '进项税率', 'decimal(18,4)', 'in_tax_rate', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '生产许可证', '生产许可证', 'nvarchar(200)', 'pro_license', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '注册证号', '注册证号', 'nvarchar(200)', 'refistration_number', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '毛重', '毛重', 'decimal(18,4)', 'gross_weight', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '净重', '净重', 'decimal(18,4)', 'net_weight', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '长', '长', 'decimal(18,4)', 'length', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '宽', '宽', 'decimal(18,4)', 'wide', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '高', '高', 'decimal(18,4)', 'high', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '体积', '体积', 'decimal(18,4)', 'volume', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '可用库存', '可用库存', 'decimal(18,4)', 'qty_inv', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '即时库存', '即时库存', 'decimal(18,4)', 'valid_qty', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '最小包装量', '最小包装量', 'decimal(18,4)', 'min_package_qty', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '默认生产车间编码', '默认生产车间编码', 'nvarchar(100)', 'product_department_number', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '是否倒冲领料', '是否倒冲领料', 'bit', 'is_backflushed', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '倒冲仓库名称', '倒冲仓库名称', 'nvarchar(200)', 'backflushed_stock_name', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '倒冲仓库编码', '倒冲仓库编码', 'nvarchar(100)', 'backflushed_stock_number', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '倒冲仓位名称', '倒冲仓位名称', 'nvarchar(200)', 'backflushed_space_name', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '商品标签', '商品标签', 'nvarchar(500)', 'mul_label', 'detail'],
  // 商品价格(price_entity 首行)
  ['BD_MATERIAL', 'bs_inv', '采购价', '采购价', 'decimal(18,4)', 'price_entity.price_purchase_price', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '零售价', '零售价', 'decimal(18,4)', 'price_entity.price_retail_price', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '批发价', '批发价', 'decimal(18,4)', 'price_entity.price_trade_price', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '配送价', '配送价', 'decimal(18,4)', 'price_entity.price_distribution_price', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '最低销售价', '最低销售价', 'decimal(18,4)', 'price_entity.price_min_sales_price', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '最高采购价', '最高采购价', 'decimal(18,4)', 'price_entity.price_max_purchase_price', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '最近采购价', '最近采购价', 'decimal(18,4)', 'price_entity.price_near_pur_price', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '最近销售价', '最近销售价', 'decimal(18,4)', 'price_entity.price_near_sal_price', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '最近含税采购价', '最近含税采购价', 'decimal(18,4)', 'price_entity.price_near_pur_tax_price', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '最近含税销售价', '最近含税销售价', 'decimal(18,4)', 'price_entity.price_near_sal_tax_price', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '最近采购入库成本', '最近采购入库成本', 'decimal(18,4)', 'price_entity.price_near_pur_unit_cost', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '最近成交供应商', '最近成交供应商', 'nvarchar(200)', 'price_entity.price_near_supplier', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '委外价', '委外价', 'decimal(18,4)', 'price_entity.price_outsourceprice', 'detail'],
  ['BD_MATERIAL', 'bs_inv', '价格单位', '价格单位', 'nvarchar(100)', 'price_entity.price_unit_name', 'detail'],
  // ── 客户 ──
  ['BD_CUSTOMER', 'dm_kh', '客户分类编码', '客户分类编码', 'nvarchar(100)', 'group_number', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '价格等级编码', '价格等级编码', 'nvarchar(100)', 'c_level_number', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '业务员编码', '业务员编码', 'nvarchar(100)', 'saler_number', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '结算客户', '结算客户', 'nvarchar(200)', 'settle_customer_name', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '结算客户编码', '结算客户编码', 'nvarchar(100)', 'settle_customer_number', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '部门', '部门', 'nvarchar(200)', 'sale_dept_name', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '部门编码', '部门编码', 'nvarchar(100)', 'sale_dept_number', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '增值税税率', '增值税税率', 'decimal(18,4)', 'rate', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '开票名称', '开票名称', 'nvarchar(200)', 'invoice_name', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '发票类型', '发票类型', 'nvarchar(20)', 'invoice_type', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '国家编码', '国家编码', 'nvarchar(50)', 'country_number', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '省份编码', '省份编码', 'nvarchar(50)', 'province_number', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '城市编码', '城市编码', 'nvarchar(50)', 'city_number', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '区县编码', '区县编码', 'nvarchar(50)', 'district_number', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '结算期限', '结算期限', 'nvarchar(100)', 'setting_term_name', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '结算期限编码', '结算期限编码', 'nvarchar(100)', 'setting_term_number', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '自动抵扣预收款', '自动抵扣预收款', 'bit', 'deduct', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '信用额度', '信用额度', 'decimal(18,4)', 'credit_limit', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '创建人', '创建人', 'nvarchar(100)', 'creater_field_name', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '创建时间', '创建时间', 'datetime2', 'create_time', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '修改时间', '修改时间', 'datetime2', 'modify_time', 'detail'],
  // 客户联系人(bomentity 首行;非敏感字段)
  ['BD_CUSTOMER', 'dm_kh', '联系人性别', '联系人性别', 'nvarchar(10)', 'bomentity.gender', 'detail'],
  ['BD_CUSTOMER', 'dm_kh', '首要联系人', '首要联系人', 'bit', 'bomentity.is_default_linkman', 'detail'],
];

const esc = (s) => String(s).replace(/'/g, "''");
// 物理类型 → yj_field.data_type
const dataTypeOf = (t) => (t.startsWith('decimal') || t === 'float' ? '小数' : t === 'bit' ? '是否' : t === 'int' ? '整数' : t === 'datetime2' ? '日期' : '文本');
// 新增标签的英文译名(缺则合并进迁移;已有译名的 IF NOT EXISTS 自动跳过)
const EN = {
  创建时间: 'Created At', 修改时间: 'Modified At', 创建人: 'Created By', 修改人: 'Modified By',
  长编码: 'Long Code', 换算类型: 'Conversion Type', 精度处理: 'Precision Handling', 是否叶子节点: 'Leaf Node', 级次: 'Level',
  部门全称: 'Full Dept. Name', 上级编码: 'Parent Code', 性别: 'Gender', 部门编码: 'Dept. Code',
  入职日期: 'Hire Date', 离职日期: 'Leave Date', 国家: 'Country', 省: 'Province', 市: 'City', 区: 'District',
  启用仓位管理: 'Bin Management', 允许负库存: 'Allow Negative Stock', 仓库管理员编码: 'Keeper Code',
  采购员部门: 'Purchaser Dept.', 自动抵扣预收款: 'Auto Offset Advance', 助记码: 'Mnemonic Code', 产地: 'Origin',
  商品类型: 'Item Type', 是否可销售: 'Sellable', 是否可采购: 'Purchasable', 是否为子件: 'Can Be Component',
  是否为组件: 'Can Be Assembly', 是否多单位: 'Multi-UOM', 辅助单位: 'Aux. UOM', 辅助单位编码: 'Aux. UOM Code',
  是否启用保质期: 'Shelf-life Enabled', 保质期: 'Shelf Life', 保质期单位: 'Shelf-life Unit', 预警天数: 'Alarm Days',
  是否启用辅助属性: 'Aux. Attributes', 库存管理方式: 'Inventory Mode', 最低库存: 'Min. Stock', 最高库存: 'Max. Stock',
  预警库存: 'Alarm Stock', 销项税率: 'Output Tax Rate', 进项税率: 'Input Tax Rate', 生产许可证: 'Production License',
  注册证号: 'Registration No.', 毛重: 'Gross Weight', 净重: 'Net Weight', 长: 'Length', 宽: 'Width', 高: 'Height',
  体积: 'Volume', 可用库存: 'Available Stock', 即时库存: 'On-hand Stock', 最小包装量: 'Min. Package Qty',
  默认生产车间编码: 'Default Workshop Code', 是否倒冲领料: 'Backflush Issue', 倒冲仓库名称: 'Backflush Warehouse',
  倒冲仓库编码: 'Backflush Warehouse Code', 倒冲仓位名称: 'Backflush Bin', 商品标签: 'Item Labels',
  采购价: 'Purchase Price', 零售价: 'Retail Price', 批发价: 'Wholesale Price', 配送价: 'Distribution Price',
  最低销售价: 'Min. Sales Price', 最高采购价: 'Max. Purchase Price', 最近采购价: 'Last Purchase Price',
  最近销售价: 'Last Sales Price', 最近含税采购价: 'Last Purchase Price (Tax incl.)', 最近含税销售价: 'Last Sales Price (Tax incl.)',
  最近采购入库成本: 'Last Purchase Receipt Cost', 最近成交供应商: 'Last Supplier', 委外价: 'Outsource Price', 价格单位: 'Price UOM',
  客户分类编码: 'Customer Group Code', 价格等级编码: 'Price Level Code', 业务员编码: 'Salesperson Code',
  结算客户: 'Settle Customer', 结算客户编码: 'Settle Customer Code', 部门: 'Department',
  增值税税率: 'VAT Rate (%)', 开票名称: 'Invoice Name', 发票类型: 'Invoice Type',
  国家编码: 'Country Code', 省份编码: 'Province Code', 城市编码: 'City Code', 区县编码: 'District Code',
  结算期限: 'Settlement Term', 结算期限编码: 'Settlement Term Code', 信用额度: 'Credit Limit',
  联系人性别: 'Contact Gender', 首要联系人: 'Primary Contact',
};
const byTable = new Map();
for (const s of SPEC) {
  if (!byTable.has(s[1])) byTable.set(s[1], []);
  byTable.get(s[1]).push(s);
}
const out = [];
out.push('-- migrate-kingdee-archive-fields.sql — 基础资料档案按金蝶真实接口字段补齐(①档:接口返回且非敏感)');
out.push('-- 生成器:tools/archive/_gen-archive-fields.mjs(规格即文档);依据:沙箱接口实测 deploy/_probe-archive-fields.mjs');
out.push('-- 口径:敏感密文(bank_account/addr/tel/mobile/email/birthday/qq/wechat/证件号)不落;接口不提供的字段(客户洞察/标签/来源/禁用人)不做;');
out.push('--      纯 id 字段(creator_id/storekeeper_id 等)不落(保留其名称/编码孪生字段)。');
out.push('-- 幂等:列 COL_LENGTH 守卫 / yj_field IF NOT EXISTS / 译名 MERGE NOT MATCHED。');
out.push('USE HSDZ_MES;');
out.push('SET NOCOUNT ON;');
out.push('GO');
out.push('');
for (const [table, items] of byTable) {
  out.push(`-- ══ ${table}(${items.length} 列)══`);
  for (const [, , col, , type] of items) {
    out.push(`IF COL_LENGTH('dbo.${table}', N'${col}') IS NULL ALTER TABLE dbo.${table} ADD [${col}] ${type} NULL;`);
  }
  out.push('GO');
  out.push('');
}
// yj_field 注册(place 默认 detail;序号接 900 段避免与既有冲突)
out.push('-- ══ yj_field 注册(面板可见;seq 900 段)══');
for (const [code, , col, label, type, , place] of SPEC) {
  out.push(`IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='${code}' AND col_name=N'${col}')`);
  out.push(`    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('${code}', N'${col}', N'${label}', N'${dataTypeOf(type)}', N'${place}', 900, 130, 1, 0, 0, 1);`);
}
out.push('GO');
out.push('');
// 译名(en;已有译名的标签由 IF NOT EXISTS 跳过)
out.push('-- ══ 新增标签英文译名(其余语言由机翻兜底)══');
const labels = [...new Set(SPEC.map((s) => s[3]))];
let missingEN = 0;
for (const l of labels) {
  const en = EN[l];
  if (!en) { missingEN++; out.push(`-- ⚠ 待补英译:${l}`); continue; }
  out.push(`IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'${esc(l)}' AND locale='en')`);
  out.push(`    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'${esc(l)}', 'en', N'${esc(en)}', 'manual');`);
}
out.push('GO');
if (missingEN) console.error(`⚠ ${missingEN} 个标签缺英译`);
out.push('');
out.push("PRINT N'migrate-kingdee-archive-fields 完成(档案字段按接口补齐)';");
out.push('GO');
// 直接写 UTF-8 文件(避免 ps 重定向写成 UTF-16 导致 SqlRunner 读失败)
const target = join(HERE, '..', 'migrate-kingdee-archive-fields.sql');
writeFileSync(target, out.join('\n'), 'utf8');
console.log('已生成:', target, `(${out.length} 行)`);
