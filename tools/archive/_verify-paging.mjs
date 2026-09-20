/**
 * _verify-paging.mjs — 全面板分页核对:totalSize 与逐页取回的单据数/唯一单号是否一致,页边界是否越界
 * 用法: node tools/archive/_verify-paging.mjs [面板编号...]   (默认跑量大的单据面板)
 */
const API = process.env.YJ_API || 'http://localhost:8090/api';
const PANELS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['PU_ORDER', 'SO_ORDER', 'PURCHASE_IN', 'SL_RECV', 'QC_INSP'];

const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login?.data?.token;
if (!token) { console.error('登录失败', JSON.stringify(login)); process.exit(1); }

const q = async (panelCode, pageNo, pageSize) => {
  const r = await fetch(API + '/px/queryFormDataList', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode, condition: {}, pageNo, pageSize }),
  });
  const j = await r.json();
  if (j.code !== 0 && j.code !== 200) throw new Error(panelCode + ' page' + pageNo + ': ' + JSON.stringify(j).slice(0, 200));
  return j.data;
};
const noOf = (r) => String(r['编号'] ?? r['单据编号'] ?? r['单号'] ?? '');

let bad = 0;
for (const p of PANELS) {
  const first = await q(p, 1, 200);
  const total = first.totalSize;
  const pageCount = Math.max(1, Math.ceil(total / 200));
  const seen = new Set(); let rows = 0; const pageLens = []; const empties = [];
  for (let i = 1; i <= pageCount + 2; i++) {
    const d = await q(p, i, 200);
    pageLens.push(d.list.length);
    rows += d.list.length;
    if (i <= pageCount && d.list.length === 0) empties.push(i);
    for (const x of d.list) seen.add(noOf(x));
  }  const okTotal = seen.size === total;
  const okPage = empties.length === 0;
  // 末页应有记录(非空页)
  const lastLen = pageLens[pageCount - 1] ?? -1;
  const okLast = lastLen > 0;
  const pass = okTotal && okPage && okLast;
  if (!pass) bad++;
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${p}: totalSize=${total} 页数=${pageCount} 逐页唯一单号=${seen.size} 记录行数=${rows}`);
  console.log(`        每页条数(前 5/末 3)=${JSON.stringify(pageLens.slice(0, 5))}…${JSON.stringify(pageLens.slice(-3))} 空页=${JSON.stringify(empties)}`);
  console.log(`        第 ${pageCount + 1} 页(越界)=${(await q(p, pageCount + 1, 200)).list.length} 条,第 ${pageCount + 2} 页=${(await q(p, pageCount + 2, 200)).list.length} 条`);
  // 排序核对:第 1 页必须是"最新"单据(按创建时间倒序)
  const p1 = await q(p, 1, 20);
  const times = p1.list.map((r) => String(r['创建时间'] ?? r['日期'] ?? ''));
  console.log(`        第 1 页前 5 单号=${JSON.stringify(p1.list.slice(0, 5).map(noOf))}`);
  console.log(`        第 1 页前 5 创建时间=${JSON.stringify(times.slice(0, 5))}`);
  const desc = times.every((t, i) => i === 0 || String(times[i - 1]) >= String(t));
  console.log(`        第 1 页是否按时间倒序=${desc ? '是' : '否(注意:创建时间列可能不在本面板字段内)'}`);
}
console.log(bad ? `\n${bad} 个面板有问题` : '\n全部通过');
process.exit(bad ? 1 : 0);
