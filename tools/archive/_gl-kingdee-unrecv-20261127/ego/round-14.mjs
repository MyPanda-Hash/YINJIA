const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
const r = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(tt(d)));
  if (!dlg) return { ok: false };
  const tr = [...dlg.querySelectorAll('tr')].find((x) => tt(x).includes('YJ-20261121-07'));
  if (!tr) return { ok: false, note: 'no row' };
  const btn = [...tr.querySelectorAll('button, .el-button, span')].find((el) => tt(el) === '可加入');
  if (!btn) return { ok: false, note: 'no 可加入', row: tt(tr) };
  btn.click();
  return { ok: true };
});
console.log('点可加入:', JSON.stringify(r));
await page.waitForTimeout(1500);
const picked = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(tt(d)));
  return { picked: tt(dlg.querySelector('[class*="picked"], .el-dialog__footer')).slice(0, 80) };
});
console.log('已选:', JSON.stringify(picked));
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(tt(d)));
  const btn = [...dlg.querySelectorAll('button')].find((b) => /加入合单/.test(tt(b)));
  if (btn) btn.click();
});
await page.waitForTimeout(8000);
const dialogs = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => tt(d.querySelector('.el-dialog__title')).slice(0, 40));
});
console.log('对话框:', JSON.stringify(dialogs));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r14-after-add.png' });
