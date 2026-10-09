#!/usr/bin/env node
/**
 * _q-whloc-row.mjs — 权威取证:接口对 B4-24-2 返回什么(与库内 NULL 比对,判断前端显示是否另有来源)
 * 用法: node tools/archive/_registry-audit-20261008/_q-whloc-row.mjs
 */
const BASE = 'http://127.0.0.1:8090';
const lg = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = lg.data.token;
const r = await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ panelCode: 'WHLOC', pageNo: 1, pageSize: 1 }),
});
const j = await r.json();
const head = j.data.list[0];
const locs = head.detail.locations;
console.log('头行:', head.编号, '状态:', head.状态);
console.log('明细行数:', locs.length);
for (const l of locs.slice(0, 4)) {
  console.log(`  id=${l.id} ${l.仓库}/${l.仓位编码} | 大区=[${l.大区 ?? ''}] 存储分区=[${l.存储分区 ?? ''}] 区码=${l.区码} 排=${l.排号} 位=${l.位号}`);
}
const withArea = locs.filter((l) => (l.大区 ?? '') !== '').length;
console.log(`本页 ${locs.length} 行中带大区的: ${withArea} 行`);
