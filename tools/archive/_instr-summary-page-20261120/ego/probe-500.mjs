const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(3000);
const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token');
  const variants = [
    { name: '基本', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token } },
    { name: '加Accept-Language', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token, 'Accept-Language': 'zh-CN,zh;q=0.9' } },
    { name: '加Referer', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token, 'Accept-Language': 'zh-CN,zh;q=0.9' } },
  ];
  const body = JSON.stringify({ 日期起: '2026-11-16', 日期止: '2026-11-20', 送样人: '', 单据状态: '全部', keyword: '' });
  const res = [];
  for (const v of variants) {
    const r = await fetch('/api/px/inspSummary/summary', { method: 'POST', headers: v.headers, body });
    const text = await r.text();
    res.push({ name: v.name, status: r.status, body: text.slice(0, 300) });
  }
  return res;
});
console.log(JSON.stringify(out, null, 2));
