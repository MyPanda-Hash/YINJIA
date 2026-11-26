const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
await page.waitForTimeout(1000);

// ① 退出登录（用户菜单里的「退出」）
const logout = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((el) => /^退出$/.test((el.innerText || '').trim()));
  if (!items.length) return { ok: false, reason: 'no logout item' };
  items[items.length - 1].click();
  return { ok: true };
});
console.log('退出:', JSON.stringify(logout));
await page.waitForTimeout(6000);
console.log('退出后:', JSON.stringify(await page.evaluate(() => ({ hash: location.hash, body: (document.body.innerText || '').slice(0, 120) }))));

// ② 登录页：选登录工厂 = 测试库
if ((await page.evaluate(() => location.hash)).includes('login')) {
  const sel = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('.el-select, .el-input')].map((el, i) => ({ i, cls: el.className.slice(0, 40), text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) }));
    return inputs;
  });
  console.log('登录页控件:', JSON.stringify(sel));
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r11-login.png' });
}
