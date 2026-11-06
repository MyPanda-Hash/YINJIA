const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';
const log = (...a) => console.log(...a);
await p.goto(base + '/', { timeout: 60000 });
await p.waitForTimeout(800);
await p.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) });
  const j = await r.json();
  if (j?.data?.token) localStorage.setItem('mes_token', j.data.token);
});
async function open(code, out) {
  await p.goto(base + '/#/panelx/list/' + code, { timeout: 60000 });
  await p.reload();
  await p.waitForTimeout(6000);
  const m = await p.evaluate(() => {
    const sheet = document.querySelector('.approval-sheet');
    const tbl = document.querySelector('.sg-table, .as-table');
    const r = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
    return { sheet: r(sheet), table: r(tbl),
      title: (document.querySelector('.as-title')?.textContent || '').trim(),
      titleColor: getComputedStyle(document.querySelector('.as-title') || document.body).color,
      titleSize: getComputedStyle(document.querySelector('.as-title') || document.body).fontSize,
      pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  log(code, JSON.stringify(m));
  if (out) await p.screenshot({ path: shotDir + out });
}
await open('RD_SAMPLE_EXT', 'v3-ext.png');
await open('RD_SAMPLE_INT', 'v3-int.png');
await open('RD_APPROVAL', 'v3-approval-regression.png');

// 打印态模拟（外部单）
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.waitForTimeout(5000);
await p.evaluate(() => {
  document.body.classList.add('approval-printing');
  document.documentElement.style.setProperty('--print-zoom', '0.894');
  const st = document.createElement('style'); st.id = 'probe-page';
  st.textContent = '@page { size: A4 landscape; margin: 8mm; }';
  document.head.appendChild(st);
});
await p.cdp('Emulation.setEmulatedMedia', { media: 'print' });
await p.waitForTimeout(800);
const pr = await p.evaluate(() => {
  const sheet = document.querySelector('.approval-sheet');
  const r = sheet.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height),
    zoom: getComputedStyle(sheet).zoom, printW: getComputedStyle(sheet).getPropertyValue('--sg-print-w') };
});
log('打印态:', JSON.stringify(pr));
await p.screenshot({ path: shotDir + 'v3-print-ext.png', fullPage: false });
await p.cdp('Emulation.setEmulatedMedia', { media: 'screen' });
await p.evaluate(() => { document.body.classList.remove('approval-printing'); document.getElementById('probe-page')?.remove(); });

// 三档宽度横向溢出检查
for (const [w, h] of [[1440, 900], [768, 900], [375, 812]]) {
  await p.cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await p.waitForTimeout(1200);
  const o = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyW: document.body.scrollWidth, client: document.documentElement.clientWidth }));
  log('viewport', w, JSON.stringify(o));
  await p.screenshot({ path: shotDir + `v3-w${w}.png` });
}
await p.cdp('Emulation.clearDeviceMetricsOverride', {});
await task.finish({ keep: [] });
process.exit(0);
