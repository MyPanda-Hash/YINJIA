// 探针:/api/document/search 用 key 拉全量文档目录,检索「工艺/工序/路线」
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const SECRET = 'rzF^FSmqM!iDGayw';
const randoms = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 55)]).join('');
function postHeaders() {
  const state = randoms(16);
  const sign = createHmac('sha256', SECRET).update(`state=${state}+secret=${SECRET}`, 'utf8').digest('hex').toUpperCase();
  return { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', state, sign, accessToken: '' };
}
async function search(body) {
  const r = await fetch('https://open.jdy.com/api/document/search', { method: 'POST', headers: postHeaders(), body: JSON.stringify(body) });
  return r.json().catch(() => ({}));
}
for (const key of ['', 'jdy', 'all', 'api', '客户列表']) {
  const j = await search({ key, pageIndex: 1, pageSize: 50 });
  const d = j?.data || {};
  console.log(`key=${JSON.stringify(key)} → total=${d.total} list=${d.list ? d.list.length : 'null'}`);
  if (d.list && d.list.length) {
    for (const x of d.list) console.log(`   ${x.uniqueId} | ${x.title} | ${x.documentTypeName}`);
  }
  if (d.list && d.list.length) break;
}
