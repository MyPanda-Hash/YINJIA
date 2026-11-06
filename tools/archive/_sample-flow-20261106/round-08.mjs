const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
const shotDir = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-sample-20261106/';
const log = (...a) => console.log(...a);
const st = () => p.evaluate(() => ({
  status: (document.querySelector('.doc-status, .as-status')?.textContent || '').trim(),
  sign: [...document.querySelectorAll('.sg-sign-item')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
  btns: [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent).map((b) => (b.textContent || '').trim()),
}));
const toasts = () => p.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()));
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(6000);
log('before:', JSON.stringify(await st()));
log('二级签核:', await p.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].filter((x) => x.offsetParent && (x.textContent || '').trim() === '二级签核').pop();
  if (!b) return 'no-btn'; b.click(); return 'clicked';
}));
await p.waitForTimeout(2000);
const box = await p.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box, .el-dialog')].filter((x) => x.offsetParent).pop();
  if (!b) return null;
  const ta = b.querySelector('textarea');
  if (ta) { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, '确认无误'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
  return { cls: b.className.slice(0, 30), text: (b.innerText || '').replace(/\s+/g, ' ').slice(0, 120), btns: [...b.querySelectorAll('.el-button')].map((x) => x.textContent.trim()) };
});
log('二级框:', JSON.stringify(box));
await p.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box, .el-dialog')].filter((x) => x.offsetParent).pop();
  const btn = [...(b?.querySelectorAll('.el-button') || [])].find((x) => /确定|确认/.test(x.textContent || ''));
  if (btn) btn.click();
});
await p.waitForTimeout(4500);
log('toasts:', JSON.stringify(await toasts()));
log('after:', JSON.stringify(await st()));
await p.screenshot({ path: shotDir + 'flow-6-done.png' });
await task.finish({ keep: [] });
process.exit(0);
