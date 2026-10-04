// 探针:官方文档全量检索 BOM(标题 + 正文),找出「生产管理·BOM维护」对应的接口
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
console.log(`文档目录 ${catalog.length} 篇;先按标题筛 BOM/物料清单`);
const titleHits = catalog.filter((d) => /bom|物料清单|用料|配方/i.test(d.title));
for (const d of titleHits) console.log(`  [标题] ${d.title} | ${d.uniqueId}`);

const hits = [];
let idx = 0, done = 0;
async function worker() {
  while (idx < catalog.length) {
    const d = catalog[idx++];
    const { title, md } = await content(d.uniqueId);
    done++;
    if (done % 200 === 0) console.log(`  ...${done}/${catalog.length}`);
    if (/bom/i.test(md) || /bom/i.test(title)) {
      const path = (/请求地址[:：]\s*(\S+)/.exec(md) || [])[1] || '';
      const ctx = md.split('\n').filter((l) => /bom/i.test(l)).slice(0, 6);
      hits.push({ id: d.uniqueId, title: title || d.title, path, ctx });
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
writeFileSync(new URL('./_bom-doc-hits.json', import.meta.url), JSON.stringify(hits, null, 1), 'utf8');
console.log(`\n正文命中 BOM ${hits.length} 篇:`);
for (const h of hits) console.log(`- ${h.title} | ${h.path || '(无地址)'} | ${h.id}`);
