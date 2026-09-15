// 分析:接口字段 vs MES 列的一次性差距报告(①可补 ②敏感密文 ③可忽略)
// 用法:node ../tools/archive/_gap-analyze.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const fields = JSON.parse(readFileSync(join(HERE, '_archive-fields.json'), 'utf8'));
const cols = new Map();
for (const line of readFileSync(join(HERE, '_archcols.out'), 'utf8').split(/\r?\n/)) {
  if (!line.includes('|')) continue;
  const [t, c] = line.split('|');
  if (!cols.has(t)) cols.set(t, new Set());
  cols.get(t).add(c);
}
const TABLE = {
  BD_SETTLE: 'bs_settle_type', BD_CUSGRP: 'bs_customer_group', BD_SUPGRP: 'bs_supplier_group',
  BD_MATGRP: 'bs_material_group', BD_CUR: 'bs_currency', BD_UOM: 'bs_uom', BD_DEPT: 'bs_dept',
  BD_EMP: 'bs_emp', BD_STORE: 'bs_wh', BD_MATERIAL: 'bs_inv', BD_CUSTOMER: 'dm_kh', BD_SUPPLIER: 'dm_gf',
};
// 已在同步里用到的接口键(现有映射)
const MAPPED = {
  BD_SETTLE: ['name', 'enable', 'is_default'],
  BD_CUSGRP: ['number', 'name', 'level', 'is_leaf', 'parent_id', 'remark', 'id'],
  BD_SUPGRP: ['number', 'name', 'level', 'is_leaf', 'parent_id', 'id'],
  BD_MATGRP: ['number', 'name', 'level', 'is_leaf', 'parent_id', 'id'],
  BD_CUR: ['number', 'name', 'sign', 'rate', 'exc_type', 'amt_precision', 'price_precision', 'enable', 'id'],
  BD_UOM: ['number', 'name', 'precision', 'enable', 'id'],
  BD_DEPT: ['number', 'name', 'enable', 'parent_name', 'comment', 'id'],
  BD_EMP: ['number', 'name', 'enable', 'department_name', 'id'],
  BD_STORE: ['number', 'name', 'enable', 'address', 'storekeeper_name', 'id'],
  BD_MATERIAL: ['number', 'name', 'model', 'parent_id', 'parent_number', 'cost_method', 'base_unit_name', 'is_batch', 'is_serial', 'barcode', 'create_time', 'modify_time', 'enable', 'id'],
  BD_CUSTOMER: ['number', 'name', 'enable', 'group_name', 'c_level_name', 'saler_name', 'taxpayer_no', 'bank', 'remark', 'id'],
  BD_SUPPLIER: ['number', 'name', 'enable', 'group_name', 'saler_name', 'taxpayer_no', 'remark', 'account_entity', 'id'],
};
// 敏感(接口返回 AES 密文)识别:base64 形态且带 = 填充
const isCipher = (v) => typeof v === 'string' && /^[A-Za-z0-9+/]{16,}={1,2}$/.test(v);
// 已知敏感字段直接名单(与面板字段对照.md 的"敏感数据解密"标注一致)
const KNOWN_SENSITIVE = new Set(['addr', 'tel', 'email', 'bank_account', 'mobile', 'phone', 'id_number', 'birthday', 'qq', 'wechat',
  'contact_address', 'contact_phone', 'contact_email', 'invoice_phone', 'invoice_email', 'account_open_addr', 'income_acc_no', 'income_bank_code']);

for (const [code, rec] of Object.entries(fields)) {
  const t = TABLE[code];
  const have = cols.get(t) || new Set();
  const keys = rec.detailKeys && rec.detailKeys.length ? rec.detailKeys : rec.listKeys;
  const sample = rec.detailSample || {};
  const mapped = new Set(MAPPED[code] || []);
  const addable = [], sensitive = [], skipped = [];
  for (const k of keys) {
    if (mapped.has(k)) continue;
    if (KNOWN_SENSITIVE.has(k) || isCipher(sample[k])) { sensitive.push(k); continue; }
    if (['id', 'custom_field'].includes(k)) { skipped.push(k + '(锚点/自定义)'); continue; }
    if (k.startsWith('sub_')) continue;
    addable.push(`${k}${sample[k] !== undefined ? '=' + String(sample[k]).slice(0, 24) : '(样例空)'}`);
  }
  console.log('\n══ %s(%s → %s) 接口 %d 键 / MES 列 %d ══', code, rec.label, t, keys.length, have.size);
  console.log('  ①可补(%d): %s', addable.length, addable.join(' | ') || '-');
  console.log('  ②敏感密文(%d): %s', sensitive.length, sensitive.join(', ') || '-');
  if (skipped.length) console.log('  ③忽略: %s', skipped.join(', '));
  const subKeys = Object.keys(rec).filter((k) => k.startsWith('sub_'));
  for (const sk of subKeys) console.log('  子表 %s: %s', sk.replace('sub_', '').replace('_keys', ''), rec[sk].join(', '));
}
