// 探针:BOM 接口核查(星辰 jdy/v2/bd/bom)—— 是否存在、字段结构、账套数据量
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

// ---- ① 官方文档:BOM 列表 ----
const SECRET = 'rzF^FSmqM!iDGayw';
const randoms = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 55)]).join('');
function postHeaders() {
  const state = randoms(16);
  const sign = createHmac('sha256', SECRET).update(`state=${state}+secret=${SECRET}`, 'utf8').digest('hex').toUpperCase();
  return { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', state, sign, accessToken: '' };
}
async function doc(id) {
  const r = await fetch('https://open.jdy.com/api/document_info/content', { method: 'POST', headers: postHeaders(), body: JSON.stringify({ id }) });
  const j = await r.json();
  return { title: j?.data?.title || '', md: j?.data?.content || '' };
}
const { title, md } = await doc('9c2c4958712511eda0b361e90d734914');
console.log(`===== 官方文档:${title} (${md.length} 字) =====`);
console.log((/请求地址[:：]\s*(\S+)/.exec(md) || [])[1] || '(无地址)');
const resp = md.split(/#{2,6}\s*响应参数/)[1] || '';
console.log('\n--- 响应参数(原样前 80 行)---');
console.log(resp.split('\n').slice(0, 80).join('\n'));

// ---- ② 真实账套:BOM 数据量 + 字段 ----
const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
console.log('\n===== 真实账套实测 =====');
for (const [label, path] of [['BOM单', '/jdy/v2/bd/bom'], ['BOM单(带明细?)', '/jdy/v2/bd/bom_detail'], ['BOM单(备选)', '/jdy/v2/bd/bom_list']]) {
  const r = await kingdeeTryGet(cfg.kingdee, token, path, { page: '1', page_size: '5' });
  if (!r.ok) { console.log(`❌ ${label} ${path} → ${r.error}`); continue; }
  const d = r.data || {};
  const rows = d.rows || [];
  console.log(`✅ ${label} ${path} → count=${d.count ?? rows.length}`);
  if (rows[0]) {
    console.log(`   顶层键(${Object.keys(rows[0]).length}): ${Object.keys(rows[0]).join(', ')}`);
    for (const k of Object.keys(rows[0])) {
      const v = rows[0][k];
      if (Array.isArray(v)) {
        console.log(`   子表 ${k}: ${v.length} 行;元素键(${v[0] ? Object.keys(v[0]).length : 0}): ${v[0] ? Object.keys(v[0]).join(', ') : '空'}`);
      }
    }
    console.log('   首行样本:', JSON.stringify(rows[0]).slice(0, 800));
  }
}
