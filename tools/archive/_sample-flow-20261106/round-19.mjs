const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(6000);
await p.evaluate(() => [...document.querySelectorAll('.as-side-btn')].filter((b) => b.offsetParent && b.textContent.trim() === '新增').pop()?.click());
await p.waitForTimeout(3000);
const has = await p.evaluate(() => ({ ref: !!document.querySelector('.sg-info-ref'), ctl: document.querySelectorAll('.sg-info-row .as-ref-ctl').length }));
console.log('ref 控件:', JSON.stringify(has));
await p.evaluate(() => document.querySelector('.sg-info-ref')?.click());
await p.waitForTimeout(2500);
const dlg = await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  return d ? { title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(),
    btns: [...d.querySelectorAll('.el-button')].map((b) => (b.textContent || '').trim()), rows: d.querySelectorAll('.el-table__row').length } : null;
});
console.log('弹窗:', JSON.stringify(dlg));
await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  const row = d?.querySelector('.el-table__row');
  const cb = row?.querySelector('input[type=checkbox]');
  if (cb) cb.click(); else row?.click();
});
await p.waitForTimeout(700);
const btns = await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  return [...(d?.querySelectorAll('.el-button') || [])].map((b) => (b.textContent || '').trim());
});
console.log('勾选后按钮:', JSON.stringify(btns));
await p.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).pop();
  const ok = [...(d?.querySelectorAll('.el-button') || [])].find((b) => /确定导入/.test(b.textContent || ''));
  if (ok) ok.click();
});
await p.waitForTimeout(1800);
const after = await p.evaluate(() => ({ open: !![...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent).length,
  val: (document.querySelector('.sg-info-row .sg-info-ref .as-ref-text')?.textContent || '').trim() }));
console.log('选完:', JSON.stringify(after));
await task.finish({ keep: [] });
process.exit(0);
