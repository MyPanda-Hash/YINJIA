const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';
const log = (...a) => console.log(...a);
const clickBtn = (txt) => p.evaluate((t) => {
  const b = [...document.querySelectorAll('.as-side-btn')].filter((x) => x.offsetParent && (x.textContent || '').trim() === t).pop();
  if (!b) return 'no-btn'; if (b.classList.contains('disabled')) return 'disabled'; b.click(); return 'clicked';
}, txt);
const boxInfo = () => p.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box, .el-dialog')].filter((x) => x.offsetParent).pop();
  if (!b) return null;
  return { cls: b.className.slice(0, 40), text: (b.innerText || '').replace(/\s+/g, ' ').slice(0, 140),
    btns: [...b.querySelectorAll('.el-button')].map((x) => (x.textContent || '').trim()),
    selects: b.querySelectorAll('.el-select').length, textareas: b.querySelectorAll('textarea').length };
});
const clickInBox = (re) => p.evaluate((r) => {
  const b = [...document.querySelectorAll('.el-message-box, .el-dialog')].filter((x) => x.offsetParent).pop();
  if (!b) return 'no-box';
  const btn = [...b.querySelectorAll('.el-button')].find((x) => new RegExp(r).test((x.textContent || '').trim()));
  if (!btn) return 'no-btn:' + [...b.querySelectorAll('.el-button')].map((x) => x.textContent.trim()).join('|');
  btn.click(); return 'ok:' + btn.textContent.trim();
}, re);
const st = () => p.evaluate(() => ({
  status: (document.querySelector('.doc-status, .as-status')?.textContent || '').trim(),
  sign: [...document.querySelectorAll('.sg-sign-item')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
  btns: [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent).map((b) => (b.textContent || '').trim()),
}));
const toasts = () => p.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()));

await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(6000);

// 1) 提交审批
log('提交审批:', await clickBtn('提交审批'));
await p.waitForTimeout(1500);
log('提交框:', JSON.stringify(await boxInfo()));
log('确认提交:', await clickInBox('确认提交审批|确定'));
await p.waitForTimeout(4500);
log('toasts:', JSON.stringify(await toasts()));
log('after 提交:', JSON.stringify(await st()));
await p.screenshot({ path: shotDir + 'flow-3-submitted.png' });

// 2) 一级审批通过 → 选二级(确认人)
log('审批通过:', await clickBtn('审批通过'));
await p.waitForTimeout(2500);
log('L2 框:', JSON.stringify(await boxInfo()));
await p.screenshot({ path: shotDir + 'flow-4-l2pick.png' });
// 选第一个候选(下拉)
await p.evaluate(() => {
  const b = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  const sel = b?.querySelector('.el-select');
  if (sel) sel.querySelector('.el-select__wrapper')?.click() || sel.click();
});
await p.waitForTimeout(1200);
await p.evaluate(() => {
  const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.offsetParent);
  if (opts.length) opts[0].click();
});
await p.waitForTimeout(800);
log('选项:', await p.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.offsetParent).map((x) => (x.textContent || '').trim()).slice(0, 5)));
log('L2 确认:', await clickInBox('确定|确认|提交'));
await p.waitForTimeout(4500);
log('toasts:', JSON.stringify(await toasts()));
log('after L1:', JSON.stringify(await st()));
await p.screenshot({ path: shotDir + 'flow-5-l1done.png' });

// 3) 二级确认
log('审批通过(二级):', await clickBtn('审批通过'));
await p.waitForTimeout(2000);
log('二级框:', JSON.stringify(await boxInfo()));
await p.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].filter((x) => x.offsetParent).pop();
  const ta = b?.querySelector('textarea');
  if (ta) { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, '确认'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
});
log('二级确认:', await clickInBox('确定|确认'));
await p.waitForTimeout(5000);
log('toasts:', JSON.stringify(await toasts()));
log('after L2:', JSON.stringify(await st()));
await p.screenshot({ path: shotDir + 'flow-6-done.png' });
await task.finish({ keep: [] });
process.exit(0);
