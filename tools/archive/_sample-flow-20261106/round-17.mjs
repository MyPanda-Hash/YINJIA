const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';
const align = () => p.evaluate(() => {
  const table = document.querySelector('.sg-table');
  if (!table) return { missing: true };
  const box = table.getBoundingClientRect();
  const rights = (sel) => [...table.querySelectorAll(sel)].map((e) => Math.round((e.getBoundingClientRect().right - box.left) * 10) / 10);
  return { cols: rights('tr.sg-head-row th'), info: rights('tr.sg-info-row td'), sign: rights('tr.sg-sign-row td') };
});
await p.goto(base + '/', { timeout: 60000 });
await p.waitForTimeout(700);
await p.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) });
  const j = await r.json();
  if (j?.data?.token) localStorage.setItem('mes_token', j.data.token);
});
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(6000);
// 新增 → 编辑态
await p.evaluate(() => [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent && b.textContent.trim() === '新增').pop()?.click());
await p.waitForTimeout(3500);
const m = await align();
console.log('编辑态对齐:', JSON.stringify(m));
const set = new Set((m.cols || []).slice(0, -1).map((v) => Math.round(v)));
const off = (arr) => (arr || []).slice(0, -1).filter((v) => ![...set].some((c) => Math.abs(c - v) <= 1));
console.log('   信息条越界:', JSON.stringify(off(m.info)), '签名条越界:', JSON.stringify(off(m.sign)));
await p.screenshot({ path: shotDir + 'align-ext-edit.png' });
// 打印态
await p.evaluate(() => {
  document.body.classList.add('approval-printing');
  document.documentElement.style.setProperty('--print-zoom', '0.894');
  const st = document.createElement('style'); st.id = 'probe-page';
  st.textContent = '@page { size: A4 landscape; margin: 8mm; }';
  document.head.appendChild(st);
});
await p.cdp('Emulation.setEmulatedMedia', { media: 'print' });
await p.waitForTimeout(700);
const pr = await p.evaluate(() => {
  const s = document.querySelector('.approval-sheet').getBoundingClientRect();
  return { w: Math.round(s.width), h: Math.round(s.height) };
});
console.log('打印态:', JSON.stringify(pr));
await p.screenshot({ path: shotDir + 'align-print-ext.png' });
await p.cdp('Emulation.setEmulatedMedia', { media: 'screen' });
await p.evaluate(() => { document.body.classList.remove('approval-printing'); document.getElementById('probe-page')?.remove(); });
await task.finish({ keep: [] });
process.exit(0);
