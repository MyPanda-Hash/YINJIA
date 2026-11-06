const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';
await p.goto(base + '/', { timeout: 60000 });
await p.waitForTimeout(700);
await p.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) });
  const j = await r.json();
  if (j?.data?.token) localStorage.setItem('mes_token', j.data.token);
});
for (const code of ['RD_SAMPLE_EXT', 'RD_SAMPLE_INT']) {
  await p.goto(base + '/#/panelx/list/' + code, { timeout: 60000 });
  await p.reload();
  await p.waitForTimeout(6000);
  const m = await p.evaluate(() => {
    const table = document.querySelector('.sg-table');
    if (!table) return { missing: true };
    const box = table.getBoundingClientRect();
    const rights = (sel) => [...table.querySelectorAll(sel)].map((e) => Math.round((e.getBoundingClientRect().right - box.left) * 10) / 10);
    return { tableW: Math.round(box.width), cols: rights('tr.sg-head-row th'),
      info: rights('tr.sg-info-row td'), sign: rights('tr.sg-sign-row td'),
      data: rights('tbody tr:not(.sg-info-row):not(.sg-head-row):not(.sg-sign-row) td'),
      pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  console.log(code, JSON.stringify(m));
  if (m.cols) {
    const set = new Set(m.cols.slice(0, -1).map((v) => Math.round(v)));
    const off = (arr) => (arr || []).slice(0, -1).filter((v) => ![...set].some((c) => Math.abs(c - v) <= 1));
    console.log('   信息条竖线越界:', JSON.stringify(off(m.info)), '签名条竖线越界:', JSON.stringify(off(m.sign)));
  }
  await p.screenshot({ path: shotDir + `align-${code}.png` });
}
await task.finish({ keep: [] });
process.exit(0);
