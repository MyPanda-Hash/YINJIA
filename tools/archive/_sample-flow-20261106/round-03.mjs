const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
await p.goto(base + '/', { timeout: 60000 });
await p.waitForTimeout(1200);
await p.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) });
  const j = await r.json();
  if (j?.data?.token) localStorage.setItem('mes_token', j.data.token);
  return j?.code;
});
async function open(code, shot) {
  await p.goto(base + '/#/panelx/list/' + code, { timeout: 60000 });
  await p.reload();
  await p.waitForTimeout(6000);
  const info = await p.evaluate(() => {
    const sheet = document.querySelector('.approval-sheet');
    const tbl = document.querySelector('.sg-table');
    const r = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
    return {
      hash: location.hash, sheet: r(sheet), table: r(tbl),
      ths: [...document.querySelectorAll('.sg-table th')].map((t) => (t.textContent || '').trim()),
      infoCells: [...document.querySelectorAll('.sg-info-cell')].map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)),
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
      btns: [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent).map((b) => (b.textContent || '').trim()).slice(0, 16),
    };
  });
  console.log(code, JSON.stringify(info, null, 1));
  await p.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/' + shot });
}
await open('RD_SAMPLE_EXT', 'v2-ext.png');
await open('RD_SAMPLE_INT', 'v2-int.png');
await task.finish({ keep: [] });
process.exit(0);
