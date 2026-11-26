const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const r = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const box = [...document.querySelectorAll('.el-message-box')].find((el) => el.offsetParent !== null);
  if (!box) return { ok: false, reason: '无确认框' };
  const btn = [...box.querySelectorAll('button')].find((b) => /确认审核/.test(t(b)));
  if (!btn) return { ok: false, reason: '无确认审核按钮', box: t(box) };
  btn.click();
  return { ok: true, boxText: t(box) };
});
console.log('点确认审核:', JSON.stringify(r));
await page.waitForTimeout(6000);
const after = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return {
    messages: [...document.querySelectorAll('.el-message, .el-notification, .el-message-box')].filter((el) => el.offsetParent !== null).map(t),
    status: t(document.querySelector('.doc-status')),
    tags: [...document.querySelectorAll('.dsr-tag')].map(t),
  };
});
console.log('结果:', JSON.stringify(after));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r27-reaudit-ok.png' });
