// 订单核对:文档并集(列表∪详情) vs 映射写入 vs 面板字段 —— 输出三方矩阵
// 哨兵代理:映射取到接口值的键=sentinel 串;硬编码 null 的键=不可同步(不算写入)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DOCS } from '../../deploy/sync-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const api = JSON.parse(readFileSync(join(HERE, '_archive-fields.json'), 'utf8'));
const panelCols = new Map();
for (const line of readFileSync(join(HERE, '_panel-fields.out'), 'utf8').split(/\r?\n/)) {
  const [p, c, l] = line.split('|');
  if (!p || !c || p === 'panel_code') continue;
  if (!panelCols.has(p)) panelCols.set(p, new Set());
  panelCols.get(p).add(c);
  void l;
}
// 映射写入但不注册为面板字段的键(状态机/锚点;单据编号既是行分组键也是面板字段,不豁免)
const ALLOW = new Set(['单据状态', '审核人', '审核时间', '审批人', '审批时间', '外部数据ID', '外部单据号']);
// api 键 → 已映射(用于准确计算"未覆盖接口键")
const API_MAPPED = {
  SO_ORDER: ['bill_no', 'bill_date', 'customer_name', 'customer_number', 'settle_customer_number', 'dept_name', 'emp_name',
    'currency_id', 'exchange_rate', 'setting_term_name', 'contact_linkman', 'remark', 'bill_status', 'auditor_name', 'audit_time',
    'material_name', 'material_number', 'material_model', 'qty', 'unit_name', 'price', 'cess', 'tax_price', 'amount', 'all_amount',
    'dis_amount', 'delivery_date', 'inv_qty', 'comment'],
  PU_ORDER: ['bill_no', 'bill_date', 'supplier_name', 'supplier_number', 'currency_id', 'exchange_rate', 'setting_term_name',
    'remark', 'bill_status', 'auditor_name', 'audit_time', 'material_number', 'material_name', 'model', 'unit_name', 'qty',
    'price', 'amount', 'cess', 'tax_price', 'all_amount', 'aux_qty', 'aux_unit_name', 'stock_name', 'dis_rate', 'dis_amount',
    'delivery_date', 'inv_qty', 'comment'],
};

const sentinel = () => new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : `#${String(k)}`) });
const arr = [sentinel()];
const od = new Proxy({}, { get: (t, k) => (k === 'material_entity' ? arr : k === 'then' ? undefined : `#${String(k)}`) });
const ctxS = { currencyNameById: { get: () => '#currency' } };

let fail = 0;
for (const code of ['SO_ORDER', 'PU_ORDER']) {
  const rec = api[code];
  const doc = DOCS.find((d) => d.code === code);
  const apiKeys = new Set([...(rec?.listKeys || []), ...(rec?.detailKeys || [])]);
  const head = doc.mapHead(od, ctxS);
  const line0 = (doc.mapLines(od) || [])[0] || {};
  const mapped = new Set([...Object.entries(head), ...Object.entries(line0)]
    .filter(([k, v]) => !k.startsWith('__') && v !== null && v !== undefined && !ALLOW.has(k))
    .map(([k]) => k));
  const panel = panelCols.get(code) || new Set();
  console.log(`\n══ ${doc.label} ${code} ══`);
  console.log(`  文档并集(列表∪详情): ${apiKeys.size} 键 | 映射实际写入(非空): ${mapped.size} 键 | 面板注册: ${panel.size} 字段`);
  const notInPanel = [...mapped].filter((k) => !panel.has(k));
  const notFed = [...panel].filter((k) => !mapped.has(k));
  if (notInPanel.length) { console.log(`  ✗ 映射写入但面板未注册(${notInPanel.length}): ${notInPanel.join(', ')}`); fail += notInPanel.length; }
  if (notFed.length) { console.log(`  ✗ 面板有但映射不写(${notFed.length}): ${notFed.join(', ')}`); fail += notFed.length; }
  if (!notInPanel.length && !notFed.length) console.log('  ✓ 映射写入与面板字段完全一致');
  // 未覆盖的接口键分类(按 api→已映射 清单)
  const covered = new Set(API_MAPPED[code] || []);
  const un = [...apiKeys].filter((k) => !covered.has(k));
  const ids = un.filter((k) => /(_id|_number)$/.test(k) && !/name$/.test(k));
  const arrs = un.filter((k) => Array.isArray((rec?.detailFull || {})[k]));
  const rest = un.filter((k) => !ids.includes(k) && !arrs.includes(k) && !['id', 'custom_field', 'modify_time'].includes(k));
  console.log(`  未覆盖接口键 ${un.length} = 纯id/编码类 ${ids.length} + 子表数组 ${arrs.length} + 其他 ${rest.length}`);
  if (rest.length) console.log(`    其他(${rest.join(', ')})`);
}
console.log(fail ? `\nRESULT: FAIL(${fail})` : '\nRESULT: ALL PASS(订单映射与面板一致)');
process.exit(fail ? 1 : 0);
