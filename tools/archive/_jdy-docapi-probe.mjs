// 探针:open.jdy.com 文档站 API 目录/搜索端点猜测(找「工艺路线」官方文档 id)
import { createHmac } from 'node:crypto';

const SECRET = 'rzF^FSmqM!iDGayw';
const randoms = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 55)]).join('');
function postHeaders() {
  const state = randoms(16);
  const sign = createHmac('sha256', SECRET).update(`state=${state}+secret=${SECRET}`, 'utf8').digest('hex').toUpperCase();
  return { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', state, sign, accessToken: '' };
}
async function tryPost(path, body) {
  try {
    const r = await fetch(`https://open.jdy.com${path}`, { method: 'POST', headers: postHeaders(), body: JSON.stringify(body) });
    const t = await r.text();
    return `HTTP ${r.status} ${t.slice(0, 300).replace(/\s+/g, ' ')}`;
  } catch (e) { return `ERR ${e.message}`; }
}
async function tryGet(path) {
  try {
    const h = postHeaders();
    const r = await fetch(`https://open.jdy.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0', state: h.state, sign: h.sign, accessToken: '' } });
    const t = await r.text();
    return `HTTP ${r.status} ${t.slice(0, 300).replace(/\s+/g, ' ')}`;
  } catch (e) { return `ERR ${e.message}`; }
}

const probes = [
  ['POST', '/api/document_info/catalog', {}],
  ['POST', '/api/document_info/tree', {}],
  ['POST', '/api/document_info/list', { page: 1, size: 10 }],
  ['POST', '/api/document_info/search', { keyword: '工艺路线' }],
  ['POST', '/api/document/search', { keyword: '工艺路线' }],
  ['GET', '/api/document_info/catalog'],
  ['GET', '/api/document/catalog'],
  ['GET', '/api/document_info/list'],
  ['POST', '/api/document_info/content', { id: '9c3d3950712511eda0b3f9343e4297f7' }],
];
for (const [m, p, b] of probes) {
  const r = m === 'POST' ? await tryPost(p, b) : await tryGet(p);
  console.log(`${m} ${p} → ${r}`);
}
