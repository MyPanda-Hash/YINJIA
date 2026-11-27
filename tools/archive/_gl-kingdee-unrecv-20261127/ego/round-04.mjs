const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
const r = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '生单');
  if (!g) return { ok: false };
  const caret = g.querySelector('.tb-caret');
  if (caret) { caret.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); caret.click(); }
  else g.querySelector('.tb-main').click();
  return { ok: true, hasCaret: !!caret };
});
console.log('点生单▼:', JSON.stringify(r));
await page.waitForTimeout(1500);
const menus = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return [...document.querySelectorAll('.tb-menu')].map((el) => ({ vis: el.offsetParent !== null, text: t(el) })).filter((x) => x.text);
});
console.log('菜单:', JSON.stringify(menus));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r04-menu.png' });
