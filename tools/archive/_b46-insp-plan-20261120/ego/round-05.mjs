const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const r = await page.evaluate(() => {
  const hits = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent || '').trim() === '新增');
  return hits.map(e => ({ tag: e.tagName, cls: e.className, parentCls: e.parentElement && e.parentElement.className }));
});
console.log('hits', JSON.stringify(r, null, 2));
const clicked = await page.evaluate(() => {
  const hits = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent || '').trim() === '新增');
  const el = hits[0];
  if (!el) return 'none';
  (el.closest('button, .el-button, [class*="op"], li, div') || el).click();
  return el.outerHTML.slice(0, 200);
});
console.log('clicked', clicked);
await page.waitForTimeout(3000);
const after = await page.evaluate(() => ({
  hash: location.hash,
  text: (document.body.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 1200),
  inputs: [...document.querySelectorAll('input')].map(i => ({ ph: i.placeholder, cls: i.className, val: i.value })).slice(0, 30),
}));
console.log(JSON.stringify(after, null, 2));
