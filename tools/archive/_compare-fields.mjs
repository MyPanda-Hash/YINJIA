// 双向对照表:金蝶真实接口字段 ↔ MES 面板列(自动校验,可重复跑)
// 用法:node tools/archive/_compare-fields.mjs [--verbose]
// 校验四件事(任一不过即 FAIL):
//   ① SPEC 里的接口键必须真实存在于沙箱响应(防臆造/拼错)
//   ② SPEC 里的 MES 列必须注册在该面板的 yj_field(防插错面板码)
//   ③ sync-core.mapArchive 必须真的写出该 MES 列(防映射漂移)
//   ④ 列出未覆盖的接口字段 与 无接口来源的面板列(双向缺口清单)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOCS } from '../../deploy/sync-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const verbose = process.argv.includes('--verbose');
const api = JSON.parse(readFileSync(join(HERE, '_archive-fields.json'), 'utf8'));
const panelCols = new Map();   // 面板码 -> Set(物理列)
const panelList = [];          // [panelCode, col, label]
for (const line of readFileSync(join(HERE, '_panel-fields.out'), 'utf8').split(/\r?\n/)) {
  const [p, c, l] = line.split('|');
  if (!p || !c || p === 'panel_code') continue;
  if (!panelCols.has(p)) panelCols.set(p, new Set());
  panelCols.get(p).add(c);
  panelList.push([p, c, l]);
}

// ══ 对照表(接口键 → MES 列;一个接口键可对应多列,用数组)══
// 敏感密文字段(SKIP):金蝶返回 AES 密文,按策略不落库
const SPEC = {
  BD_SETTLE: { panel: 'SETTLE', map: { name: ['名称'], enable: ['停用'], is_default: ['是否默认'] } },
  BD_CUSGRP: { panel: 'CUSGRP', map: { number: ['编码'], name: ['名称'], level: ['级次'], is_leaf: ['是否叶子节点'], 'parent_id→编码': ['上级编码'], remark: ['备注'] } },
  BD_SUPGRP: { panel: 'SUPGRP', map: { number: ['编码'], name: ['名称'], level: ['级次'], is_leaf: ['是否叶子节点'], 'parent_id→编码': ['上级编码'] } },
  BD_MATGRP: { panel: 'MATGRP', map: { number: ['编码'], name: ['名称'], level: ['级次'], is_leaf: ['是否叶子节点'], 'parent_id→编码': ['上级编码'], create_time: ['创建时间'], modify_time: ['修改时间'] } },
  BD_CUR: { panel: 'CUR', map: { number: ['编码'], name: ['名称'], sign: ['币别符号'], rate: ['汇率'], exc_type: ['汇率类型'], amt_precision: ['金额小数位'], price_precision: ['单价小数位'], creator_name: ['创建人'], create_time: ['创建时间'], modifier_name: ['修改人'], modify_time: ['修改时间'], enable: ['停用'] } },
  BD_UOM: { panel: 'UOM', map: { number: ['计量单位编码'], name: ['计量单位名称'], conversion_type: ['单位类型'], precision: ['小数位数'], precision_account: ['精度处理'], long_number: ['长编码'], is_leaf: ['是否叶子节点'], level: ['级次'], create_time: ['创建时间'], modify_time: ['修改时间'], enable: ['停用'] } },
  BD_DEPT: { panel: 'DEPT', map: { number: ['部门编码'], name: ['部门名称'], parent_name: ['上级部门'], parent_number: ['上级编码'], level: ['级次'], long_number: ['长编码'], full_name: ['部门全称'], is_leaf: ['是否叶子节点'], comment: ['备注'], enable: ['停用'] } },
  BD_EMP: { panel: 'EMP', map: { number: ['员工编码'], name: ['员工名称'], department_name: ['所属部门'], department_number: ['部门编码'], gender: ['性别'], hire_date: ['入职日期'], leave_date: ['离职日期'], enable: ['停用'], mobile: ['手机'], id_number: ['证件号码'], email: ['邮箱'], birthday: ['生日'], wechat: ['微信'] } },
  BD_STORE: { panel: 'WH', map: { number: ['仓库编码'], name: ['仓库名称'], address: ['仓库地址'], storekeeper_name: ['负责人'], storekeeper_number: ['仓库管理员编码'], group_name: ['仓库分类'], group_number: ['仓库分类编码'], country_name: ['国家'], province_name: ['省'], city_name: ['市'], district_name: ['区'], allow_negative: ['允许零库存出库'], is_allow_neg: ['允许零库存出库'], is_allow_freight: ['启用仓位管理'], enable: ['停用'], mobile: ['联系电话'] } },
  BD_MATERIAL: { panel: 'INV', map: {
    number: ['存货编码'], name: ['存货名称'], model: ['规格型号'], 'parent_id→分类名': ['所属类别'], base_unit_name: ['计量单位'], barcode: ['条形码'],
    help_code: ['助记码'], producing_pace: ['产地'], check_type: ['商品类型'], remark: ['备注'], cost_method: ['计价方式'],
    is_sale: ['是否可销售'], is_purchase: ['是否可采购'], is_subpart: ['是否为子件'], is_assembly: ['是否为组件'], is_multi_unit: ['是否多单位'],
    aux_unit_name: ['辅助单位'], aux_unit_number: ['辅助单位编码'], is_kf_period: ['是否启用保质期'], kf_period: ['保质期'], kf_period_type: ['保质期单位'],
    alarm_day: ['预警天数'], is_asst_attr: ['是否启用辅助属性'], inv_mgr_type: ['库存管理方式'],
    min_inventory_qty: ['最低库存'], max_inventory_qty: ['最高库存'], sec_inventory_qty: ['预警库存'],
    tax_rate: ['销项税率'], in_tax_rate: ['进项税率'], pro_license: ['生产许可证'], refistration_number: ['注册证号'],
    gross_weight: ['毛重'], net_weight: ['净重'], length: ['长'], wide: ['宽'], high: ['高'], volume: ['体积'],
    qty_inv: ['可用库存'], valid_qty: ['即时库存'], min_package_qty: ['最小包装量'],
    product_department_number: ['默认生产车间编码'], is_backflushed: ['是否倒冲领料'],
    backflushed_stock_name: ['倒冲仓库名称'], backflushed_stock_number: ['倒冲仓库编码'], backflushed_space_name: ['倒冲仓位名称'],
    mul_label: ['商品标签'], enable: ['停用'],
    'price_entity.price_cost_price': ['参考成本'], 'price_entity.price_purchase_price': ['采购价'], 'price_entity.price_retail_price': ['零售价'],
    'price_entity.price_trade_price': ['批发价'], 'price_entity.price_distribution_price': ['配送价'], 'price_entity.price_min_sales_price': ['最低销售价'],
    'price_entity.price_max_purchase_price': ['最高采购价'], 'price_entity.price_near_pur_price': ['最近采购价'], 'price_entity.price_near_sal_price': ['最近销售价'],
    'price_entity.price_near_pur_tax_price': ['最近含税采购价'], 'price_entity.price_near_sal_tax_price': ['最近含税销售价'],
    'price_entity.price_near_pur_unit_cost': ['最近采购入库成本'], 'price_entity.price_near_supplier': ['最近成交供应商'],
    'price_entity.price_outsourceprice': ['委外价'], 'price_entity.price_unit_name': ['价格单位'],
    brand_name: ['品牌'], brand_number: ['品牌编码'], stock_name: ['默认仓库'], stock_number: ['默认仓库编码'],
    base_unit_number: ['基本单位编码'], is_self_restraint: ['是否自制'], units: ['多单位'], url: ['图片链接'],
    '派生(is_batch/is_serial)': ['属性'], '派生(create_time)': ['建档日期'],
  } },
  BD_CUSTOMER: { panel: 'KHDA', map: {
    number: ['dm'], name: ['mc'], group_name: ['khlb'], group_number: ['客户分类编码'], c_level_name: ['khjb'], c_level_number: ['价格等级编码'],
    saler_name: ['ywman'], saler_number: ['业务员编码'], settle_customer_name: ['结算客户'], settle_customer_number: ['结算客户编码'],
    sale_dept_name: ['部门'], sale_dept_number: ['部门编码'], rate: ['增值税税率'], invoice_name: ['开票名称'], invoice_type: ['发票类型'],
    taxpayer_no: ['sui_no'], bank: ['bank'], country_name: ['gj'], province_name: ['sheng'], city_name: ['shi'], district_name: ['qu'],
    country_number: ['国家编码'], province_number: ['省份编码'], city_number: ['城市编码'], district_number: ['区县编码'],
    setting_term_name: ['结算期限'], setting_term_number: ['结算期限编码'], deduct: ['自动抵扣预收款'], credit_limit: ['信用额度'],
    creater_field_name: ['创建人'], create_time: ['创建时间'], modify_time: ['修改时间'], remark: ['bz'],
    'bomentity.contact_person': ['lxr'], 'bomentity.gender': ['联系人性别'], 'bomentity.is_default_linkman': ['首要联系人'],
    'bomentity.mobile': ['联系人手机', 'tel'], 'bomentity.phone': ['联系人座机', 'tel'], 'bomentity.email': ['联系人邮箱', 'email'],
    'bomentity.birthday': ['联系人生日'], 'bomentity.qq': ['联系人QQ'], 'bomentity.wechat': ['联系人微信'],
    'bomentity.contact_address': ['联系人地址'], invoice_email: ['收票邮箱'], invoice_phone: ['收票手机号'],
    enable: ['停用(asp_cancel)'],
    addr: ['addr'], bank_account: ['bank_no'], account_open_addr: ['开户地址'],
  } },
  BD_SUPPLIER: { panel: 'GFDA', map: { number: ['dm'], name: ['mc'], group_name: ['gysfl'], group_number: ['供应商分类编码'], saler_name: ['ywman'], sale_dept_name: ['采购员部门'], taxpayer_no: ['sui_no'], rate: ['增值税税率'], invoice_name: ['开票名称'], account_open_addr: ['开户地址'], deduct: ['自动抵扣预收款'], remark: ['bz'], enable: ['停用(asp_cancel)'], bank: ['bank'], 'account_entity.income_bank_name': ['bank'], bank_account: ['bank_no'], 'account_entity.income_acc_no': ['bank_no'], 'bom_entity.contact_person': ['联系人'], 'bom_entity.mobile': ['供应商联系人手机'], 'bom_entity.phone': ['供应商联系人座机'], 'bom_entity.email': ['供应商联系人邮箱'], 'bom_entity.contact_address': ['供应商联系人地址', 'addr'], 'bom_entity.phone': ['tel', '供应商联系人座机'], 'bom_entity.mobile': ['供应商联系人手机'] } },
};

let fail = 0;
const rows = [];
for (const [code, spec] of Object.entries(SPEC)) {
  const rec = api[code];
  const doc = DOCS.find((d) => d.code === code);
  // 键集 = 列表 ∪ 详情(实测两者字段集不同,实现亦按并集同步)
  const apiKeys = new Set([...(rec?.listKeys || []), ...(rec?.detailKeys || [])]);
  const subKeys = new Set();
  for (const k of Object.keys(rec || {})) if (k.startsWith('sub_')) for (const s of rec[k]) subKeys.add(`${k.replace('sub_', '').replace('_keys', '')}.${s}`);
  const panel = panelCols.get(spec.panel) || new Set();
  // mapArchive 实际输出(用 列表∪详情 的合并样本,与运行期一致)
  const merged = { ...(rec?.listFull || {}) };
  for (const [k, v] of Object.entries(rec?.detailFull || {})) {
    const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty && k in merged) continue;
    merged[k] = v;
  }
  const full = merged;
  const ctx = { matgrpById: new Map(), matgrpNameById: new Map(), cusgrpById: new Map(), supgrpById: new Map() };
  let mappedKeys = new Set();
  try { mappedKeys = new Set(Object.keys(doc.mapArchive(full, ctx))); } catch (e) { console.log(`[${code}] mapArchive 抛错: ${e.message}`); fail++; }
  const coveredApi = new Set();
  for (const [apiKey, mesCols] of Object.entries(spec.map)) {
    const isSkip = apiKey.startsWith('SKIP_');
    const realKey = apiKey.replace(/^SKIP_/, '');
    const base = realKey.split('.')[0].split('→')[0].replace(/^派生\(|\)$/g, '');
    const apiOk = isSkip || apiKeys.has(realKey) || apiKeys.has(base) || subKeys.has(realKey) || realKey.includes('→') || realKey.startsWith('派生');
    if (!apiOk) { console.log(`[${code}] ①接口键不存在于真实响应: ${realKey}`); fail++; }
    if (!isSkip) coveredApi.add(base);
    for (const mes of mesCols) {
      if (mes.includes('(')) { rows.push([code, realKey, mes, isSkip ? '锚点' : '派生']); continue; }
      const inPanel = panel.has(mes);
      const inMap = mappedKeys.has(mes);
      if (!inPanel) { console.log(`[${code}] ②面板列未注册: ${spec.panel}.${mes}`); fail++; }
      if (!isSkip && !inMap) { console.log(`[${code}] ③mapArchive 未写出: ${mes}`); fail++; }
      rows.push([code, realKey, mes, isSkip ? '敏感跳过' : (inPanel && inMap ? '✅' : `${inPanel ? '' : '面板缺'}${inMap ? '' : '映射缺'}`)]);
    }
  }
  // ④ 未覆盖接口字段
  const uncovered = [...apiKeys].filter((k) => !coveredApi.has(k) && !['id', 'custom_field', 'modify_time'].includes(k));
  const extraSub = [...subKeys].filter((k) => !coveredApi.has(k.split('.')[0]));
  console.log(`\n══ ${code}(${rec?.label} → ${spec.panel}) 接口 ${apiKeys.size} 键 / 面板 ${panel.size} 列 ══`);
  if (uncovered.length) console.log(`  ④未覆盖接口字段(${uncovered.length}): ${uncovered.join(', ')}`);
  if (extraSub.length) console.log(`  ④未用子表键(${extraSub.length}): ${extraSub.slice(0, 12).join(', ')}${extraSub.length > 12 ? ' …' : ''}`);
  // ⑤ 面板列无接口来源
  const fedCols = new Set(Object.values(spec.map).flat().filter((m) => !m.includes('(')));
  const orphan = [...panel].filter((c) => !fedCols.has(c));
  if (orphan.length) console.log(`  ⑤面板列无接口来源(${orphan.length}): ${orphan.join(', ')}`);
}
if (verbose) { console.log('\n── 明细 ──'); for (const r of rows) console.log(r.join(' | ')); }
console.log(fail ? `\nRESULT: FAIL(${fail})` : '\nRESULT: ALL PASS(①接口键真实 ②面板列已注册 ③映射已写出)');
process.exit(fail ? 1 : 0);
