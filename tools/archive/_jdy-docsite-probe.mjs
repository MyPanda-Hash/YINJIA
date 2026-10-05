// 探针:摸清 open.jdy.com 文档站的接口(用于枚举官方 API 目录),找「工艺路线/工序」文档
import { createHmac } from 'node:crypto';

const SECRET = 'rzF^FSmqM!iDGayw';
const randoms = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 55)]).join('');
function postHeaders() {
  const state = randoms(16);
  const sign = createHmac('sha256', SECRET).update(`state=${state}+secret=${SECRET}`, 'utf8').digest('hex').toUpperCase();
  return { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', state, sign, accessToken: '' };
}

const html = await (await fetch('https://open.jdy.com/', { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
console.log('index.html 长度', html.length);
const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
console.log('脚本:', scripts.slice(0, 10).join('\n  '));
const found = new Set();
for (const s of scripts.slice(0, 20)) {
  const url = s.startsWith('http') ? s : `https://open.jdy.com${s.startsWith('/') ? '' : '/'}${s}`;
  try {
    const t = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    for (const m of t.matchAll(/\/api\/[a-zA-Z0-9_\-/]+/g)) found.add(m[0]);
  } catch (e) { console.log('  skip', url, e.message); }
}
console.log('\n=== 站点 API 路径 ===');
console.log([...found].sort().join('\n'));
