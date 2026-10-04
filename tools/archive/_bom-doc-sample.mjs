// 探针:打印金蝶《BOM单列表》官方文档的完整响应示例 + MaterialEntity 全量键,作为映射夹具
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const SECRET = 'rzF^FSmqM!iDGayw';
const randoms = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 55)]).join('');
function postHeaders() {
  const state = randoms(16);
  const sign = createHmac('sha256', SECRET).update(`state=${state}+secret=${SECRET}`, 'utf8').digest('hex').toUpperCase();
  return { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', state, sign, accessToken: '' };
}
const r = await fetch('https://open.jdy.com/api/document_info/content', { method: 'POST', headers: postHeaders(), body: JSON.stringify({ id: '9c2c4958712511eda0b361e90d734914' }) });
const j = await r.json();
const md = j?.data?.content || '';
writeFileSync(new URL('./_bom-doc.md', import.meta.url), md, 'utf8');
console.log(`标题=${j?.data?.title} 长度=${md.length} 已存 _bom-doc.md`);
const idx = md.indexOf('响应示例');
console.log('\n===== 响应示例 =====');
console.log(md.slice(idx, idx + 4000));
