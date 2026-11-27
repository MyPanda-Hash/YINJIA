const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const btn = [...document.querySelectorAll('.tb-group')].find((g) => tt(g.querySelector('.act-name')) === '查询');
  if (btn) (btn.querySelector('.tb-main') || btn).click();
});
await page.waitForTimeout(6000);
const info = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const rows = [...document.querySelectorAll('tr')].filter((tr) => tr.querySelector('.el-checkbox'));
  return {
    rowCount: rows.length,
    sample: rows.slice(0, 6).map((r) => tt(r).slice(0, 60)),
    total: tt(document.body).match(/共\s*(\d+)\s*条/)?.[0] || '',
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 2000));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r21-list.png' });
