// 探针:产品查询BOM(/jdy/v2/bd/bom_query)按真实商品 id 逐个试,看账套里到底有没有 BOM 数据
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const G = (p, q) => kingdeeTryGet(cfg.kingdee, token, p, q);

// ① 取商品列表(带 id/number/name)
const mats = await G('/jdy/v2/bd/material', { page: '1', page_size: '60' });
const rows = mats.ok ? (mats.data.rows || []) : [];
console.log(`商品列表: ${mats.ok ? mats.data.count : mats.error} 条,样本 ${rows.length}`);
const targets = rows.slice(0, 20).map((r) => ({ id: String(r.id), no: r.number, name: r.name }));
for (const t of targets) console.log(`   ${t.no} | ${t.name} | ${t.id}`);

// ② 逐个商品调「产品查询BOM」
console.log('\n===== /jdy/v2/bd/bom_query(material_id=商品id)=====');
let hit = 0;
for (const t of targets) {
  const r = await G('/jdy/v2/bd/bom_query', { material_id: t.id, page: '1', page_size: '20' });
  if (!r.ok) { console.log(`❌ ${t.no} → ${r.error}`); continue; }
  const d = r.data || {};
  const rs = d.rows || [];
  console.log(`${Number(d.count) > 0 ? '★' : ' '} ${t.no} | ${t.name} → count=${d.count} rows=${rs.length}`);
  if (rs.length) {
    hit++;
    console.log('   首行:', JSON.stringify(rs[0]).slice(0, 700));
    if (hit >= 3) break;
  }
}

// ③ 顺带看「根据产品查询BOM」/jdy/v2/pm/bom 的错误原文(区分 519=无此接口 与 参数/权限错)
const pm = await fetch(`https://api.kingdee.com/jdy/v2/pm/bom?material_id=${encodeURIComponent(targets[0]?.id || '1')}`, {
  headers: { 'app-token': token, 'X-GW-Router-Addr': cfg.kingdee.domain },
}).catch((e) => ({ status: 'ERR ' + e.message }));
console.log('\n/jdy/v2/pm/bom 原始响应:', pm.status ?? '');
