// 探针:抓出文档目录里全部「金蝶KIS(koas)」接口清单(标题+请求地址),找工艺路线主数据接口
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const SECRET = 'rzF^FSmqM!iDGayw';
const randoms = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 55)]).join('');
function postHeaders() {
  const state = randoms(16);
  const sign = createHmac('sha256', SECRET).update(`state=${state}+secret=${SECRET}`, 'utf8').digest('hex').toUpperCase();
  return { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', state, sign, accessToken: '' };
}
async function content(id) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('https://open.jdy.com/api/document_info/content', { method: 'POST', headers: postHeaders(), body: JSON.stringify({ id }) });
      const j = await r.json();
      return { title: j?.data?.title || '', md: j?.data?.content || '' };
    } catch { await new Promise((r) => setTimeout(r, 700 * (i + 1))); }
  }
  return { title: '', md: '' };
}

const catalog = JSON.parse(readFileSync(new URL('./_jdy-doc-catalog.json', import.meta.url), 'utf8'));
const rows = [];
let idx = 0;
async function worker() {
  while (idx < catalog.length) {
    const d = catalog[idx++];
    const { title, md } = await content(d.uniqueId);
    const path = (/请求地址[:：]\s*(\S+)/.exec(md) || [])[1] || '';
    if (/\/koas\//.test(md) || /\/koas\//.test(path)) rows.push({ id: d.uniqueId, title: title || d.title, path });
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
rows.sort((a, b) => a.path.localeCompare(b.path));
writeFileSync(new URL('./_koas-endpoints.json', import.meta.url), JSON.stringify(rows, null, 1), 'utf8');
console.log(`KIS(koas)接口文档 ${rows.length} 篇:`);
for (const r of rows) console.log(`${r.path || '(无地址)'} | ${r.title}`);
