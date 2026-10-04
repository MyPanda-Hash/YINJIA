// 探针:① 五个 BOM 接口的官方文档「基本信息」(请求方式/地址/适用产品版本);
//       ② 对 POST 类接口按文档 body 实测(此前只按 GET 试过,519 可能只是方法不对)。
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet, kingdeePost } from '../../deploy/kingdee-client.mjs';

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
  return j?.data?.content || '';
}

const DOCS = [
  ['BOM单列表', '9c2c4958712511eda0b361e90d734914'],
  ['BOM单详情', '9c2a2676712511eda0b34535ad178f07'],
  ['产品查询BOM', '774dac6eb08211eeaee3b95748117ca8'],
  ['根据产品查询BOM(生产管理)', '67fd31e275ab11f18fd1eff7c05e0e50'],
  ['材料分录联动查询', '78535c9fb08211eeaee31bf4436932c6'],
];
const info = {};
for (const [label, id] of DOCS) {
  const md = await doc(id);
  const head = md.split(/#{2,6}\s*请求参数/)[0];
  info[label] = md;
  console.log(`\n══════ ${label} ══════`);
  console.log(head.split('\n').filter((l) => l.trim()).slice(0, 14).join('\n'));
}

// ② POST 实测
const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const mat = await kingdeeTryGet(cfg.kingdee, token, '/jdy/v2/bd/material', { page: '1', page_size: '3' });
const m0 = (mat.ok && (mat.data.rows || [])[0]) || null;
console.log(`\n\n===== 取一个真实商品做参数:${m0 ? m0.number + ' / id=' + m0.id : '(取不到)'} =====`);
if (m0) {
  const tries = [
    ['POST /jdy/v2/pm/bom', () => kingdeePost(cfg.kingdee, token, '/jdy/v2/pm/bom', {}, { material_ids: [{ material_id: String(m0.id) }] })],
    ['POST /jdy/v2/pm/bom(单对象)', () => kingdeePost(cfg.kingdee, token, '/jdy/v2/pm/bom', {}, { material_ids: [String(m0.id)] })],
    ['GET /jdy/v2/pm/bom?material_ids', () => kingdeeTryGet(cfg.kingdee, token, '/jdy/v2/pm/bom', { material_ids: String(m0.id) })],
    ['POST /jdy/v2/bd/bom_query', () => kingdeePost(cfg.kingdee, token, '/jdy/v2/bd/bom_query', {}, { material_id: String(m0.id) })],
    ['GET /jdy/v2/bd/bom_query', () => kingdeeTryGet(cfg.kingdee, token, '/jdy/v2/bd/bom_query', { material_id: String(m0.id) })],
  ];
  for (const [label, fn] of tries) {
    const r = await fn();
    console.log(`${r.ok ? '✅' : '❌'} ${label} → ${r.ok ? JSON.stringify(r.data).slice(0, 500) : r.error}`);
  }
}
