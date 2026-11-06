const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';
const log = (...a) => console.log(...a);
const st = () => p.evaluate(() => ({
  docno: (document.querySelector('.sg-table .as-docno-input input') || {}).value || '',
  status: (document.querySelector('.doc-status, .as-status')?.textContent || '').trim(),
  cells: [...document.querySelectorAll('.sg-table tbody td')].map((td) => {
    const inp = td.querySelector('input, textarea');
    return inp ? inp.value : (td.textContent || '').trim();
  }).slice(0, 13),
  btns: [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent).map((b) => (b.textContent || '').trim()),
}));
const toasts = () => p.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()));
const clickBtn = (t) => p.evaluate((x) => {
  const b = [...document.querySelectorAll('.as-side-btn')].filter((e) => e.offsetParent && (e.textContent || '').trim() === x).pop();
  if (!b) return 'no-btn'; if (b.classList.contains('disabled')) return 'disabled'; b.click(); return 'clicked';
}, t);
const setCell = (i, v) => p.evaluate(([idx, val]) => {
  const td = document.querySelectorAll('.sg-table tbody td')[idx];
  const el = td?.querySelector('textarea, input');
  if (!el) return false;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, [i, v]);

await p.goto(base + '/#/panelx/list/RD_SAMPLE_INT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(6000);
log('新增:', await clickBtn('新增'));
await p.waitForTimeout(3500);
log('blank:', JSON.stringify(await st()));
await setCell(3, '伊可普 006 项目');   // 项目名
await setCell(4, '32.5*16*180');       // 炭棒尺寸
await setCell(5, '30');                // 数量
await setCell(6, '客户需要打样评估除味效果'); // 样品背景
await p.waitForTimeout(400);
await p.screenshot({ path: shotDir + 'flow-int-1-filled.png' });
log('保存:', await clickBtn('保存'));
await p.waitForTimeout(4000);
log('toasts:', JSON.stringify(await toasts()));
log('after 保存:', JSON.stringify(await st()));
log('提交审批:', await clickBtn('提交审批'));
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].filter((x) => x.offsetParent).pop();
  const ta = b?.querySelector('textarea');
  if (ta) { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, '提交确认'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
  const btn = [...(b?.querySelectorAll('.el-button') || [])].find((x) => /确认提交|确定/.test(x.textContent || ''));
  if (btn) btn.click();
});
await p.waitForTimeout(4000);
log('toasts:', JSON.stringify(await toasts()));
log('after 提交:', JSON.stringify(await st()));
log('审批通过:', await clickBtn('审批通过'));
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box, .el-dialog')].filter((x) => x.offsetParent).pop();
  const ta = b?.querySelector('textarea');
  if (ta) { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, '同意'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
  const btn = [...(b?.querySelectorAll('.el-button') || [])].find((x) => /确认|确定/.test(x.textContent || ''));
  if (btn) btn.click();
});
await p.waitForTimeout(4500);
log('toasts:', JSON.stringify(await toasts()));
log('after 审批:', JSON.stringify(await st()));
await p.screenshot({ path: shotDir + 'flow-int-2-done.png' });
await task.finish({ keep: [] });
process.exit(0);
