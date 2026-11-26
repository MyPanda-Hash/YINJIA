const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');

// 点「弃审」菜单项
const clicked = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const menu = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null && /弃审/.test(t(el)));
  if (!menu) return { ok: false, reason: '菜单不在' };
  const item = [...menu.querySelectorAll('*')].find((el) => el.children.length === 0 && t(el) === '弃审');
  if (!item) return { ok: false, reason: '没有弃审项', menu: t(menu) };
  item.click();
  return { ok: true };
});
console.log('点弃审:', JSON.stringify(clicked));
await page.waitForTimeout(2000);

const boxes = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return {
    messageBox: [...document.querySelectorAll('.el-message-box')].filter((el) => el.offsetParent !== null).map(t),
    messages: [...document.querySelectorAll('.el-message')].map(t),
  };
});
console.log('弹框/消息:', JSON.stringify(boxes));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r24-unaudit-click.png' });
