const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const menu = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null && /批量生单/.test(t(el)));
  if (!menu) return;
  const item = [...menu.querySelectorAll('*')].find((el) => el.children.length === 0 && t(el) === '批量生单');
  if (item) item.click();
});
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = document.querySelector('.gl-dialog, .el-dialog');
  if (!dlg) return { ok: false, note: '对话框没打开' };
  const tables = [...dlg.querySelectorAll('table')].map((tb) => ({
    head: [...tb.querySelectorAll('thead th')].map((x) => t(x)),
    rows: [...tb.querySelectorAll('tbody tr')].slice(0, 30).map((tr) => [...tr.querySelectorAll('td')].map((x) => t(x))),
  }));
  return {
    ok: true,
    title: t(dlg.querySelector('.el-dialog__title')),
    tips: [...dlg.querySelectorAll('.gl-tip, .gl-jd-tip')].map(t).slice(0, 6),
    tables,
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 7000));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r05-dialog.png' });
