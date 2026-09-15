// 探针:12 类基础资料档案的真实接口字段全量导出(列表行键 + 详情键 + 样例非空值 + 子表键)
// 用法:node _probe-archive-fields.mjs [输出json路径]
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const out = process.argv[2] || '../tools/archive/_archive-fields.json';
const TARGETS = [
  ['BD_SETTLE', '结算方式', '/jdy/v2/bd/settlement_type', null],
  ['BD_CUSGRP', '客户分类', '/jdy/v2/bd/customer_group', null],
  ['BD_SUPGRP', '供应商分类', '/jdy/v2/bd/supplier_group', null],
  ['BD_MATGRP', '商品分类', '/jdy/v2/bd/material_group', null],
  ['BD_CUR', '币别', '/jdy/v2/bd/currency', '/jdy/v2/bd/currency_detail'],
  ['BD_UOM', '计量单位', '/jdy/v2/bd/measure_unit', '/jdy/v2/bd/measure_unit_detail'],
  ['BD_DEPT', '部门', '/jdy/v2/bd/department', '/jdy/v2/bd/department_detail'],
  ['BD_EMP', '职员', '/jdy/v2/bd/emp', '/jdy/v2/bd/emp_detail'],
  ['BD_STORE', '仓库', '/jdy/v2/bd/store', '/jdy/v2/bd/store_detail'],
  ['BD_MATERIAL', '商品', '/jdy/v2/bd/material', '/jdy/v2/bd/material_detail'],
  ['BD_CUSTOMER', '客户', '/jdy/v2/bd/customer', '/jdy/v2/bd/customer_detail'],
  ['BD_SUPPLIER', '供应商', '/jdy/v2/bd/supplier', '/jdy/v2/bd/supplier_detail'],
];

const { token } = await fetchAppToken(cfg.kingdee);
const res = {};
for (const [code, label, listPath, detailPath] of TARGETS) {
  const list = await kingdeeGet(cfg.kingdee, token, listPath, { page: '1', page_size: '3' });
  const rows = list.rows || [];
  const rec = { label, count: Number(list.count), listKeys: rows[0] ? Object.keys(rows[0]) : [], listSample: rows.slice(0, 2) };
  if (detailPath && rows[0]) {
    const d = await kingdeeGet(cfg.kingdee, token, detailPath, { id: rows[0].id });    rec.detailKeys = Object.keys(d);
    rec.detailFull = d;                                  // 完整详情(供对照脚本跑真实映射)
    rec.detailSample = {};
    for (const [k, v] of Object.entries(d)) {
      if (v === null || v === '' || v === undefined) continue;
      if (Array.isArray(v)) { rec.detailSample[k] = `[ARRAY ${v.length}]`; if (v.length) rec[`sub_${k}_keys`] = Object.keys(v[0]); }
      else if (typeof v === 'object') { rec.detailSample[k] = JSON.stringify(v).slice(0, 120); }
      else rec.detailSample[k] = String(v).slice(0, 80);
    }
  }
  rec.listFull = rows[0] || null;                        // 完整列表行(仅列表接口的档案用)
  res[code] = rec;
  console.log('[%s] %s 列表 %d 条 | 列表键 %d | 详情键 %d', code, label, rec.count, rec.listKeys.length, (rec.detailKeys || []).length);
}
writeFileSync(new URL(out, import.meta.url), JSON.stringify(res, null, 2), 'utf8');
console.log('已写出:', out);
