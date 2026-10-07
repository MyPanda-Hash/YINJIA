// 探针:查官方返回码文档里 519 的含义(判定「无此接口」还是「未开通/无权限」)
import { createHmac } from 'node:crypto';
const SECRET = 'rzF^FSmqM!iDGayw';
const randoms = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 55)]).join('');
function postHeaders() {
  const state = randoms(16);
  const sign = createHmac('sha256', SECRET).update(`state=${state}+secret=${SECRET}`, 'utf8').digest('hex').toUpperCase();
  return { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', state, sign, accessToken: '' };
}
const IDS = [['公告返回码', '525e704824d24b178ab466530456c037']];
for (const [label, id] of IDS) {
  const r = await fetch('https://open.jdy.com/api/document_info/content', { method: 'POST', headers: postHeaders(), body: JSON.stringify({ id }) });
  const j = await r.json();
  const md = j?.data?.content || '';
  console.log(`===== ${label} (${md.length} 字) =====`);
  const lines = md.split('\n');
  const idx = lines.findIndex((l) => /519/.test(l));
  console.log(idx >= 0 ? lines.slice(Math.max(0, idx - 6), idx + 6).join('\n') : '(未见 519)');
  console.log('\n--- 前 60 行 ---');
  console.log(lines.slice(0, 60).join('\n'));
}
