const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
// 打开「审核」组的 ▼ 子菜单，看有没有「弃审」
const r = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const groups = [...document.querySelectorAll('.tb-group')];
  const g = groups.find((x) => /^(审核|审批)$/.test(txt(x.querySelector('.act-name'))) && x.querySelector('.tb-caret'));
  if (!g) return { ok: false, note: 'no caret group', groups: groups.map((x) => txt(x.querySelector('.act-name'))) };
  g.querySelector('.tb-caret').click();
  return { ok: true, act: txt(g.querySelector('.act-name')) };
});
console.log('点开子菜单:', JSON.stringify(r));
await page.waitForTimeout(1200);
const menu = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item')].map((el) => (el.innerText || '').trim()));
console.log('子菜单项:', JSON.stringify(menu));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r17-audit-menu.png' });
