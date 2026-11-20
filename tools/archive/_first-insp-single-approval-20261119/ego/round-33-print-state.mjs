import fs from 'node:fs';
const task = await taskSpace('first-insp-print-flow-20261120');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 });
await page.waitForTimeout(6000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.evaluate(() => {
  document.body.classList.add('approval-printing');
  const el = document.querySelector('.portal-content');
  if (el) el.scrollTop = el.scrollHeight;
});
await page.waitForTimeout(1500);
const st = await page.evaluate(() => {
  const reqs = [...document.querySelectorAll('.fi-requirements li')];
  const vis = (el) => el && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().height > 0;
  const portal = document.querySelector('.portal');
  return {
    sheet: vis(document.querySelector('.fi-sheet')),
    portalVisibility: portal ? getComputedStyle(portal).visibility : null,
    colors: reqs.map((li, i) => ({ n: i + 1, color: getComputedStyle(li).color, visible: vis(li) })),
  };
});
console.log(JSON.stringify(st));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-typo/r6-print-state.png' });
const printed = await page.cdp('Page.printToPDF', { printBackground: true, landscape: true, paperWidth: 11.69, paperHeight: 8.27, marginTop: 0.3, marginBottom: 0.3, marginLeft: 0.3, marginRight: 0.3 });
fs.writeFileSync('D:/workspace/yinjia/_scratch/first-insp-typo/print-flow-8090.pdf', Buffer.from(printed.data, 'base64'));
console.log('print pdf bytes:', Buffer.from(printed.data, 'base64').length);
await page.evaluate(() => document.body.classList.remove('approval-printing'));
await task.finish({ keep: [] });
