// 探针:全账套抽样扫 BOM —— 3852 个商品按间隔抽样调 /jdy/v2/bd/bom_query,看有没有任何一个有 BOM
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const G = (p, q) => kingdeeTryGet(cfg.kingdee, token, p, q);

// ① 取全部商品(分页)
const rows = [];
for (let page = 1; page <= 25; page++) {
  const r = await G('/jdy/v2/bd/material', { page: String(page), page_size: '200' });
  if (!r.ok) { console.log('商品列表失败', r.error); break; }
  rows.push(...(r.data.rows || []));
  if (page >= Number(r.data.total_page || 1)) break;
}
console.log(`商品总数 ${rows.length}`);

// ② 抽样:每 20 个取 1(≈190 个),外加"像成品"的(编码含 CP/YJ/成品,或名称含成品/总成)
const sample = [];
const seen = new Set();
const add = (m) => { if (m && !seen.has(String(m.id))) { seen.add(String(m.id)); sample.push(m); } };
rows.filter((_, i) => i % 20 === 0).forEach(add);
rows.filter((r) => /^(CP|YJ|FG|P-)/i.test(String(r.number || '')) || /成品|总成|滤芯/.test(String(r.name || ''))).slice(0, 120).forEach(add);
console.log(`抽样 ${sample.length} 个商品查 BOM`);

let hit = 0, err = 0;
for (const m of sample) {
  const r = await G('/jdy/v2/bd/bom_query', { material_id: String(m.id), page: '1', page_size: '20' });
  if (!r.ok) { err++; continue; }
  const c = Number(r.data?.count || 0);
  if (c > 0) {
    hit++;
    console.log(`★ ${m.number} | ${m.name} | id=${m.id} → BOM ${c} 条`);
    console.log('   ', JSON.stringify((r.data.rows || [])[0]).slice(0, 800));
    if (hit >= 5) break;
  }
}
console.log(`\n抽样命中 ${hit} 个商品有 BOM(失败 ${err} 次)`);
// ③ 再确认基础资料 BOM单列表 / BOM单详情
const list = await G('/jdy/v2/bd/bom', { page: '1', page_size: '100' });
console.log('BOM单列表 count =', list.ok ? list.data.count : list.error);
