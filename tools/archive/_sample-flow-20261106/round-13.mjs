const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
await p.goto(base + '/', { timeout: 60000 });
await p.waitForTimeout(600);
await p.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) });
  const j = await r.json();
  if (j?.data?.token) localStorage.setItem('mes_token', j.data.token);
});
for (const [code, out] of [['QC_TC_IN', 'reg-tc.png'], ['RD_MOLD_PROC', 'reg-mold.png']]) {
  await p.goto(base + '/#/panelx/list/' + code, { timeout: 60000 });
  await p.reload();
  await p.waitForTimeout(6000);
  const m = await p.evaluate(() => {
    const sheet = document.querySelector('.approval-sheet, .record-sheet, .sheet-root');
    const r = sheet ? sheet.getBoundingClientRect() : null;
    return { found: !!sheet, w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0,
      pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  console.log(code, JSON.stringify(m));
  await p.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/' + out });
}
await task.finish({ keep: [] });
process.exit(0);
