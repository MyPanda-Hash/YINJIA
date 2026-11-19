const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '查询单据');
  el.click();
});
await page.waitForTimeout(2500);
const dlg = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const d = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null);
  return d.map((x) => ({
    title: t(x.querySelector('.el-dialog__title')),
    labels: [...x.querySelectorAll('.el-form-item__label, label')].map(t).slice(0, 10),
    inputs: [...x.querySelectorAll('input')].map((i) => i.placeholder).slice(0, 10),
    btns: [...x.querySelectorAll('button')].map(t),
    body: t(x.querySelector('.el-dialog__body')).slice(0, 300),
  }));
});
console.log(JSON.stringify(dlg, null, 2));
