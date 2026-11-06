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
for (const code of ['RD_APPROVAL', 'RD_SAMPLE_EXT']) {
  await p.goto(base + '/#/panelx/list/' + code, { timeout: 60000 });
  await p.reload();
  await p.waitForTimeout(5500);
  for (const w of [768, 375]) {
    await p.cdp('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
    await p.waitForTimeout(900);
    const o = await p.evaluate(() => {
      const doc = document.documentElement;
      const wide = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > doc.clientWidth + 2)
        .slice(0, 4).map((e) => ({ cls: (e.className || '').toString().slice(0, 40), right: Math.round(e.getBoundingClientRect().right) }));
      return { overflow: doc.scrollWidth - doc.clientWidth, client: doc.clientWidth, wide };
    });
    console.log(code, w, JSON.stringify(o));
    if (w === 768) await p.screenshot({ path: `/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/resp-${code}-${w}.png` });
  }
  await p.cdp('Emulation.clearDeviceMetricsOverride', {});
}
await task.finish({ keep: [] });
process.exit(0);
