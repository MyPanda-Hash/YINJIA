// 探针:遍历 open.jdy.com 全部文档正文(1228 篇),检索「工艺路线/工序」相关内容
// 输出:_jdy-doc-hits.json(命中文档)+ 控制台摘要
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
    } catch { await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
  }
  return { title: '', md: '' };
}

const catalog = JSON.parse(readFileSync(new URL('./_jdy-doc-catalog.json', import.meta.url), 'utf8'));
console.log(`文档目录 ${catalog.length} 篇,开始抓正文...`);
const hits = [];
let done = 0;
const WORKERS = 8;
let idx = 0;
async function worker() {
  while (idx < catalog.length) {
    const d = catalog[idx++];
    const { title, md } = await content(d.uniqueId);
    done++;
    if (done % 100 === 0) console.log(`  ${done}/${catalog.length}`);
    if (/工艺路线|工序/.test(md) || /工艺路线|工序/.test(title)) {
      const path = (/请求地址[:：]\s*(\S+)/.exec(md) || [])[1] || '';
      const ctx = md.split('\n').filter((l) => /工艺路线|工序/.test(l)).slice(0, 8);
      hits.push({ id: d.uniqueId, title: title || d.title, path, context: ctx });
      console.log(`★ ${title || d.title} | ${path}`);
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
writeFileSync(new URL('./_jdy-doc-hits.json', import.meta.url), JSON.stringify(hits, null, 1), 'utf8');
console.log(`\n完成:抓取 ${done} 篇,命中「工艺路线/工序」${hits.length} 篇`);
for (const h of hits) console.log(`- ${h.title} | ${h.path} | ${h.id}`);
