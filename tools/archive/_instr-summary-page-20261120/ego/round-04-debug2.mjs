// 调试2:读页面上的日期区间输入值 + 在页面内用同一 token 重放 summary 请求,定位"为什么 0 行"
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(5000);
const info = await page.evaluate(async () => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const dates = [...document.querySelectorAll('.iss-range input')].map((i) => i.value);
  const token = localStorage.getItem('mes_token');
  const rep = await fetch('/api/px/inspSummary/summary', {
    method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ 日期起: dates[0], 日期止: dates[1], 送样人: '', 单据状态: '全部', keyword: '' }),
  }).then((r) => r.json()).catch((e) => ({ err: String(e) }));
  return {
    dates,
    tokenLen: token ? token.length : 0,
    stats: [...document.querySelectorAll('.iss-stat')].map(t),
    replay: { code: rep.code, stat: rep.data?.汇总, docs: rep.data?.按单据?.length },
  };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-04-debug2.png' });
console.log({ screenshot: shot });
