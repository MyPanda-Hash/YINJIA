// 探针:open.jdy.com /api/document/search 参数形态与「工艺路线」检索
import { createHmac } from 'node:crypto';

const SECRET = 'rzF^FSmqM!iDGayw';
const randoms = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 55)]).join('');
function postHeaders() {
  const state = randoms(16);
  const sign = createHmac('sha256', SECRET).update(`state=${state}+secret=${SECRET}`, 'utf8').digest('hex').toUpperCase();
  return { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', state, sign, accessToken: '' };
}
async function search(body) {
  const r = await fetch('https://open.jdy.com/api/document/search', { method: 'POST', headers: postHeaders(), body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  const list = j?.data?.list;
  return list ? `total=${j.data.total} 首条=${JSON.stringify(list[0]).slice(0, 200)}` : `空 (${JSON.stringify(j).slice(0, 150)})`;
}

const shapes = [
  { title: '客户列表' }, { key: '客户列表' }, { searchKey: '客户列表' }, { name: '客户列表' },
  { keyword: '客户列表' }, { query: '客户列表' }, { content: '客户列表' },
  { title: '客户列表', pageIndex: 1, pageSize: 10 },
  { keyword: '客户列表', pageIndex: 1, pageSize: 10 },
];
for (const s of shapes) console.log(JSON.stringify(s).padEnd(52), '→', await search(s));

console.log('\n=== 用有效形态检索「工艺路线 / 工序 / 路线」===');
for (const kw of ['工艺路线', '工序', '路线', '生产任务单']) {
  for (const body of [{ title: kw, pageIndex: 1, pageSize: 20 }, { name: kw, pageIndex: 1, pageSize: 20 }]) {
    console.log(kw, JSON.stringify(body).slice(0, 40), '→', await search(body));
  }
}
