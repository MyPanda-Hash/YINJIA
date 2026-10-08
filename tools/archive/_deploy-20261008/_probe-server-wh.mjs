#!/usr/bin/env node
/**
 * _probe-server-wh.mjs — 深挖服务器 bs_wh / bs_wh_loc 现状(只读)
 * 上一步已发现:WH 面板 30 行、WHLOC 面板 2 行,而本地是 10 / 679 —— 不同源,必须看清。
 * 做法:先打印响应真实键名(别猜),再逐行 dump。
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090';
const r0 = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }), signal: AbortSignal.timeout(20000),
});
const token = (await r0.json()).data.token;
const api = async (body) => {
  const r = await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  return r.json();
};

for (const [code, size] of [['WH', 40], ['WHLOC', 10]]) {
  const j = await api({ panelCode: code, pageNo: 1, pageSize: size });
  const d = j?.data ?? j;
  console.log(`\n======== ${code} ========`);
  console.log('data 键:', Object.keys(d || {}).join(', '));
  const list = d?.list ?? [];
  console.log(`list 行数: ${list.length}; totalSize=${d?.totalSize ?? '—'}`);
  const first = list[0];
  if (first) {
    console.log('首行顶层键:', Object.keys(first).join(', '));
    const detailKey = Object.keys(first.detail ?? {})[0];
    console.log('detail 键:', Object.keys(first.detail ?? {}).join(', '), '| 首个明细数组:', detailKey);
    const lines = first.detail?.[detailKey] ?? [];
    console.log(`首行明细 ${lines.length} 行;明细行键:`, lines[0] ? Object.keys(lines[0]).join(', ') : '(无)');
    console.log('--- 头行字段 ---');
    for (const k of Object.keys(first)) {
      if (k === 'detail') continue;
      const v = first[k];
      if (v && typeof v === 'object') continue;
      console.log(`   ${k} = ${v}`);
    }
    console.log('--- 明细(最多 12 行)---');
    lines.slice(0, 12).forEach((l, i) => {
      const pick = Object.fromEntries(Object.entries(l).filter(([k]) => !['id', 'asp_user1', 'asp_user2', 'asp_time1', 'asp_time2'].includes(k)));
      console.log(`   [${i}] ${JSON.stringify(pick)}`);
    });
    if (lines.length > 12) console.log(`   …(还有 ${lines.length - 12} 行)`);
  }
}
