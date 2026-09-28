// 探针:金蝶真实账套里「价格 / 税金」到底有没有在用(材料出库对口的生产领料单为主,带同族对照)
//   输出:各单据 头/行 的 价格族、税金族 键是否**存在**、以及有值/非零 的行数占比
// 用法: node deploy/_probe-price-tax.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from './kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const out = {};

// 价格族 / 税金族 键名(金蝶星辰各单据的常见写法)
const PRICE_KEYS = ['price', 'tax_price', 'act_tax_price', 'dis_price', 'base_price', 'cost', 'unit_cost',
  'amount', 'all_amount', 'tax_amount', 'dis_tax_amount', 'total_amount', 'dis_amount', 'pre_dis_amount',
  'cess', 'tax_rate', 'dis_rate', 'bill_dis_amount', 'act_non_tax_amount', 'currency_price'];
const FAMILY = (k) => /cess|tax/.test(k) ? '税金族' : '价格族';

/** 逐键统计:存在? 有值行数? 非零行数? 样例值 */
async function stat(cfg, token, label, path, sampleDocs = 60) {
  const list = await kingdeeTryGet(cfg, token, path, { page: '1', page_size: String(sampleDocs) });
  if (!list.ok) { console.log(`❌ ${label} ${path} → ${list.error}`); return null; }
  const rows = list.data.rows || [];
  const rec = { label, path, count: Number(list.data.count), docs: 0, lines: 0, headKeys: [], lineKeys: [], stat: {}, samples: {} };
  let detailPath = path + '_detail';
  const d = rows.length ? await kingdeeTryGet(cfg, token, detailPath, { id: rows[0].id }) : { ok: false };
  if (!d.ok) { detailPath = path + '_detail_bill'; }
  if (rows.length) {
    const first = await kingdeeTryGet(cfg, token, detailPath, { id: rows[0].id });
    if (first.ok) {
      rec.detailPath = detailPath;
      rec.headKeys = Object.keys(first.data).filter((k) => !Array.isArray(first.data[k]));
    }
  }
  for (const r of rows) {
    const dd = await kingdeeTryGet(cfg, token, detailPath, { id: r.id });
    if (!dd.ok) continue;
    rec.docs++;
    const ents = dd.data.material_entity || [];
    if (!rec.lineKeys.length && ents.length) rec.lineKeys = Object.keys(ents[0]);
    for (const l of ents) {
      rec.lines++;
      for (const k of PRICE_KEYS) {
        if (!(k in l)) continue;
        const s = rec.stat[k] || (rec.stat[k] = { 存在: true, 有值: 0, 非零: 0, 样例: [] });
        const v = l[k];
        if (v !== null && v !== '' && v !== undefined && Number(v) !== 0) {
          s.非零++; if (s.样例.length < 4) s.样例.push(String(v));
        }
        if (v !== null && v !== '' && v !== undefined) s.有值++;
      }
    }
    await new Promise((x) => setTimeout(x, 70));
  }
  console.log(`\n=== ${label}(${path}) 单数=${rec.count} 采样 ${rec.docs} 张 / ${rec.lines} 行 ===`);
  const hits = Object.entries(rec.stat);
  if (!hits.length) console.log('  行上**没有任何** 价格/税金 键');
  for (const [k, s] of hits) {
    console.log(`  ${FAMILY(k)} ${k.padEnd(20)} 有值 ${String(s.有值).padStart(5)}/${rec.lines}  非零 ${String(s.非零).padStart(5)}  样例 ${s.样例.join(', ') || '(全 0)'}`);
  }
  const missKeys = PRICE_KEYS.filter((k) => !rec.stat[k]);
  console.log(`  行上**不存在**的键(${missKeys.length}): ${missKeys.join(', ')}`);
  const headHits = PRICE_KEYS.filter((k) => rec.headKeys.includes(k));
  console.log(`  头上出现过的价格/税金键: ${headHits.length ? headHits.join(', ') : '(无)'}`);
  if (rec.headKeys.length) console.log(`  头键全集(${rec.headKeys.length}): ${rec.headKeys.join(', ')}`);
  return rec;
}

out.pick = await stat(cfg.kingdee, token, '生产领料单(材料出库的对口单)', '/jdy/v2/scm/inv_pick', 60);
out.otherOut = await stat(cfg.kingdee, token, '其他出库单(同族对照)', '/jdy/v2/scm/inv_other_out', 40);
out.purIn = await stat(cfg.kingdee, token, '采购入库单(对照:应有税)', '/jdy/v2/scm/pur_inbound', 25);
out.salOut = await stat(cfg.kingdee, token, '销售出库单(对照:应有税)', '/jdy/v2/scm/sal_out_bound', 25);
writeFileSync(new URL('../tools/archive/_price-tax-probe.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log('\n已写出 tools/archive/_price-tax-probe.json');
