const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';
const log = (...a) => console.log(...a);
await p.goto(base + '/', { timeout: 60000 });
await p.waitForTimeout(700);
await p.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'sampler', password: '123456' }) });
  const j = await r.json(); if (j?.data?.token) localStorage.setItem('mes_token', j.data.token); else localStorage.removeItem('mes_token');
});
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(6500);
const info = await p.evaluate(() => ({
  cards: [...document.querySelectorAll('.doc-card, .dc-card, .list-card, .doc-item, [class*=card]')].filter((c) => c.offsetParent).map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)).filter((t) => t.includes('SPW')).slice(0, 8),
  pager: (document.querySelector('.doc-rail, .rail, .as-pager')?.textContent || document.querySelector('.as-side')?.textContent || '').replace(/\s+/g, ' ').slice(0, 60),
  visibleDocs: [...document.querySelectorAll('body *')].filter((e) => /SPW-2026-11-000\d/.test(e.textContent || '') && e.children.length === 0).map((e) => e.textContent.trim()).slice(0, 8),
}));
log('sampler 列表:', JSON.stringify(info));
await p.screenshot({ path: shotDir + 'vis-sampler-list.png' });
// 打开自己的单，补第 2 行做多行打印验证
await p.evaluate(() => [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent && b.textContent.trim() === '新增').pop()?.click());
await p.waitForTimeout(3000);
await p.evaluate(() => {
  const rows = () => [...document.querySelectorAll('.sg-table tbody tr')].filter((tr) => tr.querySelector('.sg-td'));
  const set = (r, c, v) => {
    const td = rows()[r]?.querySelectorAll('td')[c];
    const el = td?.querySelector('textarea, input');
    if (!el) return;
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set(0, 0, '样品A：组装后总长 180mm');
  set(0, 2, '8');
  document.querySelector('.sg-addrow')?.click();
});
await p.waitForTimeout(500);
await p.evaluate(() => {
  const rows = [...document.querySelectorAll('.sg-table tbody tr')].filter((tr) => tr.querySelector('.sg-td'));
  const set = (r, c, v) => {
    const td = rows[r]?.querySelectorAll('td')[c];
    const el = td?.querySelector('textarea, input');
    if (!el) return;
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set(1, 0, '样品B：组装后总长 205mm（加长款）');
  set(1, 3, '需配套端盖，物料编码待定');
  set(1, 2, '4');
});
await p.waitForTimeout(400);
const rowsInfo = await p.evaluate(() => [...document.querySelectorAll('.sg-table tbody tr')].filter((tr) => tr.querySelector('.sg-td')).length);
log('行数:', rowsInfo);
await p.screenshot({ path: shotDir + 'detail-multi.png' });
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
  return { w: Math.round(s.width), h: Math.round(s.height), rows: document.querySelectorAll('.sg-table tbody tr').length };
});
log('打印态:', JSON.stringify(pr));
await p.screenshot({ path: shotDir + 'detail-print.png' });
await p.cdp('Emulation.setEmulatedMedia', { media: 'screen' });
await p.evaluate(() => { document.body.classList.remove('approval-printing'); document.getElementById('probe-page')?.remove(); });
await task.finish({ keep: [] });
process.exit(0);
