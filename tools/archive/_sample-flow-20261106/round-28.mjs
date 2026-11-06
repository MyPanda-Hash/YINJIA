const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(7500);
// 加一行并填点内容，做出两行打印样张
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
  setTimeout(() => { set(1, 0, '样品B：组装后总长 205mm（加长款）'); set(1, 2, '4'); }, 300);
});
await p.waitForTimeout(1200);
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
  return { w: Math.round(s.width), h: Math.round(s.height), dataRows: [...document.querySelectorAll('.sg-table tbody tr')].filter((tr) => tr.querySelector('.sg-td')).length };
});
console.log('打印态:', JSON.stringify(pr));
await p.screenshot({ path: shotDir + 'detail-print.png' });
await p.cdp('Emulation.setEmulatedMedia', { media: 'screen' });
await p.evaluate(() => { document.body.classList.remove('approval-printing'); document.getElementById('probe-page')?.remove(); });
await task.finish({ keep: [] });
process.exit(0);
