const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';
const log = (...a) => console.log(...a);
const st = () => p.evaluate(() => ({
  docno: (document.querySelector('.sg-info-row .as-docno-input input') || {}).value || '',
  status: (document.querySelector('.doc-status, .as-status')?.textContent || '').trim(),
  rows: [...document.querySelectorAll('.sg-table tbody tr')].filter((tr) => tr.querySelector('.sg-td')).map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => { const i = td.querySelector('textarea, input'); return i ? i.value : (td.textContent || '').trim(); }).join('|')),
  sign: [...document.querySelectorAll('.sg-sign-row td')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
}));
const toasts = () => p.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()));
const clickBtn = (t) => p.evaluate((x) => {
  const b = [...document.querySelectorAll('.as-side-btn')].filter((e) => e.offsetParent && (e.textContent || '').trim() === x).pop();
  if (!b) return 'no-btn'; if (b.classList.contains('disabled')) return 'disabled'; b.click(); return 'clicked';
}, t);
await p.goto(base + '/', { timeout: 60000 });
await p.waitForTimeout(700);
await p.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' } , body: JSON.stringify({ userName: 'admin', password: '123456' }) });
  const j = await r.json(); if (j?.data?.token) localStorage.setItem('mes_token', j.data.token);
});
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(6000);
log('当前:', JSON.stringify(await st()));
// 删除第 2 行
await p.evaluate(() => { const d = [...document.querySelectorAll('.sg-rowdel')].filter((x) => x.offsetParent); d[d.length - 1]?.click(); });
await p.waitForTimeout(700);
log('删一行后:', JSON.stringify(await st()));
await clickBtn('保存');
await p.waitForTimeout(4000);
log('toasts:', JSON.stringify(await toasts()));
await p.reload();
await p.waitForTimeout(6000);
log('重载后:', JSON.stringify(await st()));
await p.screenshot({ path: shotDir + 'detail-3-deleted.png' });
// 提交 → 审核（一级，选确认人）→ 二级确认
log('提交审批:', await clickBtn('提交审批'));
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].filter((x) => x.offsetParent).pop();
  const ok = [...(b?.querySelectorAll('.el-button') || [])].find((x) => /确认提交/.test(x.textContent || ''));
  if (ok) ok.click();
});
await p.waitForTimeout(4000);
log('after 提交:', JSON.stringify(await st()), JSON.stringify(await toasts()));
log('审批通过:', await clickBtn('审批通过'));
await p.waitForTimeout(2500);
const l2dlg = await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  return d ? { title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(), btns: [...d.querySelectorAll('.el-button')].map((b) => b.textContent.trim()) } : null;
});
log('L2 弹窗:', JSON.stringify(l2dlg));
// 选第一项（下拉）
await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  const sel = d?.querySelector('.el-select');
  sel?.querySelector('.el-select__wrapper')?.click();
});
await p.waitForTimeout(1000);
await p.evaluate(() => {
  const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.offsetParent);
  if (opts.length) opts[0].click();
});
await p.waitForTimeout(600);
await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  const ok = [...(d?.querySelectorAll('.el-button') || [])].find((x) => /确认审批通过|确定/.test(x.textContent || ''));
  if (ok) ok.click();
});
await p.waitForTimeout(4500);
log('after L1:', JSON.stringify(await st()), JSON.stringify(await toasts()));
await clickBtn('二级签核');
await p.waitForTimeout(1800);
await p.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].filter((x) => x.offsetParent).pop();
  const ok = [...(b?.querySelectorAll('.el-button') || [])].find((x) => /确认审批通过|确定/.test(x.textContent || ''));
  if (ok) ok.click();
});
await p.waitForTimeout(4500);
log('after L2:', JSON.stringify(await st()), JSON.stringify(await toasts()));
await p.screenshot({ path: shotDir + 'detail-4-approved.png' });
await task.finish({ keep: [] });
process.exit(0);
