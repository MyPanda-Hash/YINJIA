// 探针:生产领料单(inv_pick)接口字段全集 + 价格/税金族实测非空率
// 用法: node deploy/_probe-invpick-fields.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from './kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const P = '/jdy/v2/scm/inv_pick';
const out = {};

const list = await kingdeeTryGet(cfg.kingdee, token, P, { page: '1', page_size: '50' });
if (!list.ok) { console.log('列表失败', list.error); process.exit(1); }
const rows = list.data.rows || [];
console.log(`【生产领料单 inv_pick】列表 count=${list.data.count} 取回 ${rows.length} 张`);
const listKeys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
out.count = Number(list.data.count);
out.listKeys = listKeys;
console.log(`列表键 ${listKeys.length}: ${listKeys.join(', ')}`);

// 详情
let detailFull = null, detailKeys = [], subKeys = {};
for (const suffix of ['_detail', '_detail_bill']) {
  const d = await kingdeeTryGet(cfg.kingdee, token, P + suffix, { id: rows[0].id });
  if (d.ok) {
    detailFull = d.data; detailKeys = Object.keys(d.data);
    console.log(`\n详情(${P + suffix}) ${detailKeys.length} 键: ${detailKeys.join(', ')}`);
    for (const [k, v] of Object.entries(d.data)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
        subKeys[k] = [...new Set(v.flatMap((x) => Object.keys(x)))];
        console.log(`子表 ${k}: ${v.length} 行, ${subKeys[k].length} 键`);
      }
    }
    break;
  } else console.log(`${P + suffix} → ${d.error}`);
}
out.detailKeys = detailKeys; out.subKeys = subKeys;

// 头/行非空率(采样 40 张详情)
const headStat = {}, lineStat = {}, lineSamples = {};
let lines = 0, docs = 0;
for (const r of rows.slice(0, 40)) {
  const d = await kingdeeTryGet(cfg.kingdee, token, P + '_detail', { id: r.id });
  if (!d.ok) continue;
  docs++;
  for (const [k, v] of Object.entries(d.data)) {
    if (Array.isArray(v)) continue;
    if (v === null || v === '' || v === undefined) continue;
    headStat[k] = (headStat[k] || 0) + 1;
  }
  for (const line of (d.data.material_entity || [])) {
    lines++;
    for (const [k, v] of Object.entries(line)) {
      if (v === null || v === '' || v === undefined) continue;
      lineStat[k] = (lineStat[k] || 0) + 1;
      if (!(k in lineSamples) && /price|amount|cess|tax|cost|rate|qty/i.test(k)) lineSamples[k] = v;
    }
  }
  await new Promise((r) => setTimeout(r, 100));
}
console.log(`\n采样 ${docs} 张 / ${lines} 行 —— 头字段非空率(按 40 张):`);
console.log(Object.entries(headStat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', '));
console.log(`\n行字段非空率(按 ${lines} 行):`);
console.log(Object.entries(lineStat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', '));
console.log('\n价格/税金族样例值:');
console.log(JSON.stringify(lineSamples, null, 2));
out.headStat = headStat; out.lineStat = lineStat; out.lineSamples = lineSamples; out.docs = docs; out.lines = lines;
out.detailSample = detailFull;
writeFileSync(new URL('../tools/archive/_invpick-fields.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log('\n已写出 tools/archive/_invpick-fields.json');
