// 探针:拉取 open.jdy.com 全量文档目录(1228 条),检索「工艺路线/工序」类文档
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
const all = [];
for (let p = 1; p <= 40; p++) {
  const j = await search({ key: 'jdy', pageIndex: p, pageSize: 100 });
  const list = j?.data?.list || [];
  if (!list.length) break;
  all.push(...list);
  if (p === 1 || p % 5 === 0) console.log(`page ${p}: 累计 ${all.length}/${j.data.total}`);
}
const uniq = [...new Map(all.map((x) => [x.uniqueId, x])).values()];
writeFileSync(new URL('./_jdy-doc-catalog.json', import.meta.url), JSON.stringify(uniq, null, 1), 'utf8');
console.log(`\n共 ${uniq.length} 篇文档,已存 _jdy-doc-catalog.json`);
console.log('\n=== 标题含 工艺/工序/路线/生产 的文档 ===');
for (const d of uniq.filter((x) => /工艺|工序|路线|生产|车间|工作中心/.test(x.title))) console.log(`${d.uniqueId} | ${d.title}`);
