const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return [...document.querySelectorAll('.el-dialog')].map((d, i) => ({
    i, vis: d.offsetParent !== null, title: tt(d.querySelector('.el-dialog__title')).slice(0, 40),
    tables: d.querySelectorAll('table').length,
  }));
});
console.log(JSON.stringify(info, null, 1));
