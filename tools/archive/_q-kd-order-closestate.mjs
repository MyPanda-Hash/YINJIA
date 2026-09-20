/**
 * _q-kd-order-closestate.mjs — 只读统计:金蝶采购订单 关闭状态/入库状态 分布(解释 MES「已中止」的来源)
 * 用法: node tools/archive/_q-kd-order-closestate.mjs
 */
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const k = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const cfg = k.kingdee || k;
const { token } = await fetchAppToken(cfg);

const CLOSE = { '': '未关闭(空)', C: '未关闭(C)', S: '已关闭(S)', H: '手动关闭(H)' };
const IO = { A: '未入库(A)', Z: '部分入库(Z)', C: '全部入库(C)' };
const byClose = new Map(), byCloseIo = new Map();
const hSamples = [];
let total = 0;
// 注意:pur_order 列表接口 page_size 上限=100(请求 200 仍回 100),故按 total_page 翻页;
// 商品接口则honor 200(实测),两者上限不同 —— 用 total_page 判断最稳。
let pageCount = 0;
for (let page = 1; page <= 60; page++) {
  const r = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { page: String(page), page_size: '100' });
  const rows = r.rows || [];
  const totalPage = Number(r.total_page || 1);
  pageCount = page;
  for (const x of rows) {
    total++;
    const c = x.bill_close_state ?? '';
    byClose.set(c, (byClose.get(c) || 0) + 1);
    const key = `${c}|${x.io_status ?? ''}`;
    byCloseIo.set(key, (byCloseIo.get(key) || 0) + 1);
    if (c === 'H' && hSamples.length < 5) hSamples.push(`${x.bill_no}(${x.io_status ?? '-'})`);
  }
  if (page >= totalPage) break;
}
console.log(`金蝶采购订单总数 = ${total}(翻 ${pageCount} 页)\n`);
console.log('按 bill_close_state 分布:');
for (const [c, n] of [...byClose.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`   '${c}' ${CLOSE[c] || '?'} → ${n} 张 (${(n / total * 100).toFixed(1)}%)`);
}
console.log('\n关闭状态 × 入库状态:');
for (const [key, n] of [...byCloseIo.entries()].sort((a, b) => b[1] - a[1])) {
  const [c, io] = key.split('|');
  console.log(`   ${CLOSE[c] || c} + ${IO[io] || io || '(空)'} → ${n} 张`);
}
console.log(`\n手动关闭(H)样例: ${hSamples.join(', ') || '(无)'}`);
