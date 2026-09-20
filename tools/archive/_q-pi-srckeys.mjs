/**
 * _q-pi-srckeys.mjs — 关键验证:采购入库行「挂了源单(采购订单)」后,接口是否多出订单数量族键
 * 用法: node tools/archive/_q-pi-srckeys.mjs
 * 比对:该行键集 vs 官方详情接口基线键集(tools/archive/_inbound-outbound-fields.json 的 sub_material_entity_keys)
 */
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const k = cfg.kingdee || cfg;
const base = JSON.parse(readFileSync(new URL('./_inbound-outbound-fields.json', import.meta.url), 'utf8'));
const BASE = new Set(base.PUR_IN.sub_material_entity_keys || []);
const { token } = await fetchAppToken(k);

const l = await kingdeeGet(k, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '50' });
const extra = new Map();          // 超出基线的键 → 命中次数
const qtyLike = new Map();        // 含 qty/数量 语义的键 → 示例值
let linked = 0, checked = 0;
const samples = [];
for (const r of (l.rows || [])) {
  const d = await kingdeeGet(k, token, '/jdy/v2/scm/pur_inbound_detail', { id: r.id });
  for (const e of (d.material_entity || [])) {
    checked++;
    const hasSrc = String(e.src_bill_no || '').trim() !== '';
    for (const key of Object.keys(e)) {
      if (!BASE.has(key)) extra.set(key, (extra.get(key) || 0) + 1);
      if (/qty|数量|src_/i.test(key)) qtyLike.set(key, { 示例: e[key], 有源单: hasSrc });
    }
    if (hasSrc) {
      linked++;
      if (samples.length < 3) samples.push({
        bill_no: d.bill_no, 商品: e.material_number, 源单编号: e.src_bill_no, 源单行号: e.src_seq,
        全部含qty键: Object.fromEntries(Object.entries(e).filter(([x]) => /qty|数量/i.test(x))),
        源单族: Object.fromEntries(Object.entries(e).filter(([x]) => x.startsWith('src_'))),
      });
    }
  }
}
console.log(`检查行数 ${checked},其中有源单 ${linked} 行`);
console.log('基线键数 =', BASE.size);
console.log('超出基线的键(键→出现次数):', JSON.stringify([...extra.entries()]));
console.log('含 qty/数量 语义的键(键→示例):');
for (const [key, v] of qtyLike) console.log(`   ${key} = ${JSON.stringify(v)}`);
console.log('挂源单行样例:');
for (const s of samples) console.log('   ' + JSON.stringify(s));
