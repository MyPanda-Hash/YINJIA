import fs from 'node:fs';
const task = await taskSpace('first-insp-red-verify-20261120');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 });
await page.waitForTimeout(6000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
const colors = await page.evaluate(() => [...document.querySelectorAll('.fi-requirements li')]
  .map((li, i) => ({ n: i + 1, color: getComputedStyle(li).color })));
console.log('8090 li colors:', JSON.stringify(colors));

// 浏览器「打印」→ PDF:验证打印件里这三条也是红字
const printed = await page.cdp('Page.printToPDF', { printBackground: true, landscape: true, paperWidth: 11.69, paperHeight: 8.27, marginTop: 0.4, marginBottom: 0.4, marginLeft: 0.4, marginRight: 0.4 });
fs.writeFileSync('D:/workspace/yinjia/_scratch/first-insp-typo/print-8090.pdf', Buffer.from(printed.data, 'base64'));
console.log('print pdf bytes:', Buffer.from(printed.data, 'base64').length);

// 5173 源码版同项核对
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 });
await page.waitForTimeout(5000);
const c2 = await page.evaluate(() => [...document.querySelectorAll('.fi-requirements li')]
  .map((li, i) => ({ n: i + 1, color: getComputedStyle(li).color })));
console.log('5173 li colors:', JSON.stringify(c2));
await page.evaluate(() => {
  document.documentElement.style.zoom = '0.62';
  const el = document.querySelector('.portal-content');
  if (el) el.scrollTop = el.scrollHeight;
});
await page.waitForTimeout(1000);
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-typo/r4-5173-red.png' });
await task.finish({ keep: [] });
