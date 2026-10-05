// 探针:从 open.jdy.com 前端 bundle 里挖出文档站 API 端点(找目录/分类接口)
const BASE = 'https://open.jdy.com';
const H = { 'User-Agent': 'Mozilla/5.0' };
async function txt(u) { const r = await fetch(u.startsWith('http') ? u : BASE + u, { headers: H }); return r.text(); }

const seeds = ['/static/js/runtime~app.c9be6dfeeb963c1799ad.js', '/static/js/10.d0e2a13d611f27c4abcc.js', '/static/js/8.00510639b2fee4d2915c.js'];
const chunks = new Set(seeds);
for (const s of seeds) {
  const t = await txt(s);
  for (const m of t.matchAll(/["']([0-9]+\.[0-9a-f]{20}\.js)["']/g)) chunks.add('/static/js/' + m[1]);
  for (const m of t.matchAll(/["'](app\.[0-9a-f]{20}\.js)["']/g)) chunks.add('/static/js/' + m[1]);
}
console.log('候选 chunk:', [...chunks].length);
const api = new Set();
for (const c of chunks) {
  try {
    const t = await txt(c);
    for (const m of t.matchAll(/["'`](\/api\/[a-zA-Z0-9_\-/.]{2,60})["'`]/g)) api.add(m[1]);
  } catch { /* ignore */ }
}
console.log('\n=== bundle 中的 /api/ 端点 ===');
console.log([...api].sort().join('\n'));
