const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const r = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => txt(x.querySelector('.act-name')) === '更多');
  if (!g) return { ok: false };
  (g.querySelector('.tb-main') || g).click();
  return { ok: true };
});
console.log('点更多:', JSON.stringify(r));
await page.waitForTimeout(1200);
const menus = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const visiblePoppers = [...document.querySelectorAll('.el-popper, .el-dropdown__popper, [class*="menu"]')]
    .filter((el) => el.offsetParent !== null);
  return visiblePoppers.map((el) => txt(el).slice(0, 300)).filter(Boolean).slice(0, 6);
});
console.log('可见菜单:', JSON.stringify(menus, null, 1));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r20-more-menu.png' });
