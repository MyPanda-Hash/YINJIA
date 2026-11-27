const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER?docNo=YJ-20261014-03', { timeout: 60000 });
await page.waitForTimeout(8000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }

const before = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return {
    status: t(document.querySelector('.doc-status')),
    toolbar: [...document.querySelectorAll('.tb-group')].map((g) => `${t(g.querySelector('.act-name'))}${/disabled/.test((g.querySelector('.tb-main') || {}).className || '') ? '(禁)' : ''}`),
  };
});
console.log('单据:', JSON.stringify(before));

// 点「生单」
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '生单');
  (g.querySelector('.tb-main') || g).click();
});
await page.waitForTimeout(1500);
const menu = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return [...document.querySelectorAll('.tb-menu')].filter((el) => el.offsetParent !== null).map(t);
});
console.log('生单菜单:', JSON.stringify(menu));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r03-menu.png' });
