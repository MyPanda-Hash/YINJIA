const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';
const log = (...a) => console.log(...a);
const st = () => p.evaluate(() => ({
  docno: (document.querySelector('.sg-info-row .as-docno-input input') || {}).value || '',
  status: (document.querySelector('.doc-status, .as-status')?.textContent || '').trim(),
  rows: [...document.querySelectorAll('.sg-table tbody tr')].filter((tr) => tr.querySelector('.sg-td')).map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => {
      const i = td.querySelector('textarea, input');
      return i ? i.value : (td.textContent || '').trim();
    }).join(' | ')),
  addable: !!document.querySelector('.sg-addrow'),
  delBtns: document.querySelectorAll('.sg-rowdel').length,
}));
const toasts = () => p.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()));

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
await p.evaluate(() => [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent && b.textContent.trim() === '新增').pop()?.click());
await p.waitForTimeout(3500);
log('新增后:', JSON.stringify(await st()));

// 客户名称
await p.evaluate(() => document.querySelector('.sg-info-ref')?.click());
await p.waitForTimeout(2600);
await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  const row = d?.querySelector('.el-table__row');
  const cb = row?.querySelector('input[type=checkbox]');
  if (cb) cb.click(); else row?.click();
});
await p.waitForTimeout(800);
await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  const ok = [...(d?.querySelectorAll('.el-button') || [])].find((b) => /确定导入/.test(b.textContent || ''));
  if (ok) ok.click();
});
await p.waitForTimeout(2000);
log('客户:', await p.evaluate(() => (document.querySelector('.sg-info-row .sg-info-ref .as-ref-text')?.textContent || '').trim()));

// 第 1 行：产品整体规格 / 样品数量
const setRow = (ri, ci, val) => p.evaluate(([r, c, v]) => {
  const rows = [...document.querySelectorAll('.sg-table tbody tr')].filter((tr) => tr.querySelector('.sg-td'));
  const td = rows[r]?.querySelectorAll('td')[c];
  const el = td?.querySelector('textarea, input');
  if (!el) return false;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, [ri, ci, val]);
await setRow(0, 0, '样品A：总长 180mm');
await setRow(0, 2, '10');
// 加第 2 行
await p.evaluate(() => document.querySelector('.sg-addrow')?.click());
await p.waitForTimeout(600);
await setRow(1, 0, '样品B：总长 200mm');
await setRow(1, 1, '32.5*16*200');
await setRow(1, 2, '5');
await p.waitForTimeout(400);
log('填完:', JSON.stringify(await st()));
await p.screenshot({ path: shotDir + 'detail-1-filled.png' });

await p.evaluate(() => [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent && b.textContent.trim() === '保存').pop()?.click());
await p.waitForTimeout(4500);
log('toasts:', JSON.stringify(await toasts()));
log('保存后:', JSON.stringify(await st()));
await p.reload();
await p.waitForTimeout(6000);
log('重载后:', JSON.stringify(await st()));
await p.screenshot({ path: shotDir + 'detail-2-saved.png' });
await task.finish({ keep: [] });
process.exit(0);
