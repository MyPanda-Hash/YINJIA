const task = await taskSpace('sample-insp-1119');
const page = task.page('p1');
await page.evaluate(() => {
  const sels = [...document.querySelectorAll('.el-select')];
  const el = sels[1];
  el.click();
});
await page.waitForTimeout(800);
const info = await page.evaluate(() => ({
  poppers: [...document.querySelectorAll('.el-select-dropdown__item')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
  html: [...document.querySelectorAll('.el-select')].map((s) => s.outerHTML.slice(0, 500)),
}));
console.log(JSON.stringify(info, null, 2));
