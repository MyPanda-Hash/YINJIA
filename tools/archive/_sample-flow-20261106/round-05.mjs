// round-05: 外部样品申请单 流程（修正参照弹窗与提示采集）
const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';

const toasts = () => p.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()));
const clickText = (sel, text) => p.evaluate(([s, t]) => {
  const el = [...document.querySelectorAll(s)].filter((e) => e.offsetParent && (e.textContent || '').trim() === t).pop();
  if (el) { el.click(); return true; } return false;
}, [sel, text]);
const openDlg = () => p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  return d ? { title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(),
    btns: [...d.querySelectorAll('.el-button')].map((b) => (b.textContent || '').trim()) } : null;
});
const closeDlg = (re) => p.evaluate((r) => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  if (!d) return 'no dialog';
  const b = [...d.querySelectorAll('.el-button')].find((x) => new RegExp(r).test((x.textContent || '').trim()));
  if (!b) return 'no btn';
  b.click(); return b.textContent.trim();
}, re);
const setVal = (selector, value, idx = 0) => p.evaluate(([sel, v, i]) => {
  const els = [...document.querySelectorAll(sel)];
  const el = els[i];
  if (!el) return false;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, [selector, value, idx]);
const status = () => p.evaluate(() => ({
  docno: (document.querySelector('.sg-info .as-docno-input input') || {}).value || '',
  status: (document.querySelector('.doc-status, .as-status')?.textContent || '').trim(),
  sign: [...document.querySelectorAll('.sg-sign-item')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
  btns: [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent).map((b) => (b.textContent || '').trim()).filter((t) => !t.startsWith('查询') && !t.startsWith('模糊') && !t.startsWith('单据预览')),
}));

await p.goto(base + '/', { timeout: 60000 });
await p.waitForTimeout(800);
await p.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) });
  const j = await r.json();
  if (j?.data?.token) localStorage.setItem('mes_token', j.data.token);
});
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(6000);

// 打开最后一张单（SPW-...0002 草稿）——列表卡片点击
const opened = await p.evaluate(() => {
  const cards = [...document.querySelectorAll('.doc-card, .list-card, .dc-card, .doc-item, .pc-card')].filter((c) => c.offsetParent);
  const target = cards.find((c) => (c.textContent || '').includes('SPW-2026-11-0002'));
  if (target) { target.click(); return (target.textContent || '').replace(/\s+/g, ' ').slice(0, 40); }
  return cards.length ? 'cards:' + cards.length : 'none';
});
console.log('打开单据:', opened);
await p.waitForTimeout(2500);
console.log('before:', JSON.stringify(await status()));

// 客户名称参照（只在为空时）
const needRef = await p.evaluate(() => {
  const cell = document.querySelector('.sg-info-ref');
  return !!cell;
});
if (needRef) {
  await p.evaluate(() => document.querySelector('.sg-info-ref')?.click());
  await p.waitForTimeout(2200);
  console.log('参照弹窗:', JSON.stringify(await openDlg()));
  await p.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
    const row = d.querySelector('.el-table__row');
    const cb = row?.querySelector('input[type=checkbox]');
    if (cb) cb.click(); else row?.click();
  });
  await p.waitForTimeout(800);
  console.log('确认导入:', await closeDlg('确定导入|确定$|确定'));
  await p.waitForTimeout(1800);
}
console.log('toasts:', JSON.stringify(await toasts()));

await setVal('.sg-info-cell input', '350', 1); // 费用是第 2 格(1=客户名称 ref 无 input ⇒ 取不到也无妨)
await setVal('.sg-table tbody textarea', '组装后总长 180mm，外径 32.5±0.5', 0);
await setVal('.sg-table tbody textarea', '20', 2); // 样品数量列(第 3 格)
await p.waitForTimeout(500);
await p.screenshot({ path: shotDir + 'flow-1-filled.png' });

console.log('保存:', await clickText('.as-side-btn', '保存'));
await p.waitForTimeout(4000);
console.log('toasts:', JSON.stringify(await toasts()));
console.log('after 保存:', JSON.stringify(await status()));

console.log('提交审批:', await clickText('.as-side-btn', '提交审批'));
await p.waitForTimeout(1800);
console.log('弹窗:', JSON.stringify(await openDlg()));
await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  const ta = d?.querySelector('textarea');
  if (ta) {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, '请审核');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
console.log('提交确认:', await closeDlg('确定|提交'));
await p.waitForTimeout(4500);
console.log('toasts:', JSON.stringify(await toasts()));
console.log('after 提交:', JSON.stringify(await status()));
await p.screenshot({ path: shotDir + 'flow-3-submitted.png' });
await task.finish({ keep: [] });
process.exit(0);
