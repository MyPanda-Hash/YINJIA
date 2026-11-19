const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP?docNo=SJ-2026-11-0013', { timeout: 30000 });
await page.waitForTimeout(6000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
const st = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const body = (document.body.innerText || '').replace(/\s+/g, ' ');
  return {
    hash: location.hash,
    docNo: (body.match(/SJ-2026-11-\d+/) || [''])[0],
    status: (body.match(/单据状态[：:\s]*([^\s]{2,8})/) || ['', ''])[1],
    foot: [...document.querySelectorAll('.fi-foot th, .fi-foot td')].map(t),
    reqCount: document.querySelectorAll('.fi-requirements li').length,
    editable: document.querySelectorAll('.fi-sheet input').length,
    hasApproverText: body.includes('批准'),
    railBtns: [...document.querySelectorAll('.as-side-btn')].map((b) => t(b) + (b.classList.contains('disabled') ? '(禁用)' : '')),
  };
});
console.log(JSON.stringify(st, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-22-approved-0013.png', fullPage: true });
