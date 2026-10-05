// 探针:① 其他出库单(inv_other_out)字段全集(对照价格/税金族) ② 沙箱是否支持 inv_pick
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from './kingdee-client.mjs';

const real = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const sand = JSON.parse(readFileSync(new URL('./push/config.json', import.meta.url), 'utf8'));
const out = {};

async function dump(cfg, token, label, P, sampleN = 30) {
  const list = await kingdeeTryGet(cfg, token, P, { page: '1', page_size: String(sampleN) });
  if (!list.ok) { console.log(`【${label}】${P} → ❌ ${list.error}`); return null; }
  const rows = list.data.rows || [];
  console.log(`\n【${label}】${P} count=${list.data.count}`);
  const rec = { path: P, count: Number(list.data.count), listKeys: [...new Set(rows.flatMap((r) => Object.keys(r)))] };
  console.log(`  列表键 ${rec.listKeys.length}: ${rec.listKeys.join(', ')}`);
  if (!rows.length) return rec;
  for (const suffix of ['_detail', '_detail_bill']) {
    const d = await kingdeeTryGet(cfg, token, P + suffix, { id: rows[0].id });
    if (!d.ok) { console.log(`  ${P + suffix} → ${d.error}`); continue; }
    rec.detailPath = P + suffix;
    rec.detailKeys = Object.keys(d.data);
    console.log(`  详情 ${rec.detailKeys.length} 键: ${rec.detailKeys.join(', ')}`);
    for (const [k, v] of Object.entries(d.data)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
        rec.subKeys = rec.subKeys || {};
        rec.subKeys[k] = [...new Set(v.flatMap((x) => Object.keys(x)))];
        console.log(`  子表 ${k}: ${rec.subKeys[k].length} 键`);
      }
    }
    rec.detailSample = d.data;
    break;
  }
  // 价格/税金族实测非空 + 取值
  const keyStat = {}, samples = {};
  let lines = 0, docs = 0;
  for (const r of rows.slice(0, sampleN)) {
    const d = await kingdeeTryGet(cfg, token, P + (rec.detailPath ? rec.detailPath.slice(P.length) : '_detail'), { id: r.id });
    if (!d.ok) continue;
    docs++;
    for (const line of (d.data.material_entity || [])) {
      lines++;
      for (const [k, v] of Object.entries(line)) {
        if (v === null || v === '' || v === undefined) continue;
        keyStat[k] = (keyStat[k] || 0) + 1;
      }
      for (const k of ['price', 'tax_price', 'cess', 'amount', 'all_amount', 'tax_amount', 'cost', 'unit_cost', 'dis_tax_amount', 'qty'])
        if (line[k] !== undefined && !(`s_${k}` in samples)) samples[`s_${k}`] = line[k];
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  console.log(`  采样 ${docs} 张 / ${lines} 行;价格税金族样例:`, JSON.stringify(samples));
  rec.docs = docs; rec.lines = lines; rec.keyStat = keyStat; rec.samples = samples;
  return rec;
}

// ① 真实账套:其他出库单(对照)
out.other_out = await dump(real.kingdee, (await fetchAppToken(real.kingdee)).token, '真实账套·其他出库单', '/jdy/v2/scm/inv_other_out', 15);
// ② 真实账套:生产领料单价格取值分布(全量抽查更大样本)
{
  const { token } = await fetchAppToken(real.kingdee);
  const r = await kingdeeTryGet(real.kingdee, token, '/jdy/v2/scm/inv_pick', { page: '1', page_size: '100' });
  const rows = r.ok ? (r.data.rows || []) : [];
  let nzPrice = 0, nzCost = 0, tot = 0, examples = [];
  for (const row of rows.slice(0, 60)) {
    const d = await kingdeeTryGet(real.kingdee, token, '/jdy/v2/scm/inv_pick_detail', { id: row.id });
    if (!d.ok) continue;
    for (const l of (d.data.material_entity || [])) {
      tot++;
      if (Number(l.price) !== 0) { nzPrice++; if (examples.length < 5) examples.push({ bill: row.bill_no, number: l.material_number, price: l.price, cost: l.cost, unit_cost: l.unit_cost }); }
      if (Number(l.cost) !== 0) nzCost++;
    }
    await new Promise((x) => setTimeout(x, 80));
  }
  console.log(`\n【生产领料单价格实测】抽查 ${tot} 行:price≠0 的 ${nzPrice} 行,cost≠0 的 ${nzCost} 行`);
  if (examples.length) console.log('  非零样例:', JSON.stringify(examples));
  out.pickPriceStat = { tot, nzPrice, nzCost, examples };
}
// ③ 沙箱:inv_pick / inv_other_out 是否可用(转ERP 默认打沙箱)
{
  const { token } = await fetchAppToken(sand.kingdee);
  for (const p of ['/jdy/v2/scm/inv_pick', '/jdy/v2/scm/inv_other_out', '/jdy/v2/scm/pur_inbound'])
    { const r = await kingdeeTryGet(sand.kingdee, token, p, { page: '1', page_size: '2' });
      console.log(`【沙箱】${p} → ${r.ok ? 'OK count=' + r.data.count : '❌ ' + r.error}`);
      out['sand' + p] = r.ok ? Number(r.data.count) : String(r.error); }
}
writeFileSync(new URL('../tools/archive/_invpick-compare.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log('\n已写出 tools/archive/_invpick-compare.json');
