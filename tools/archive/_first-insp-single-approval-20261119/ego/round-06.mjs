const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 });
await page.waitForTimeout(4000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }

const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const btns = [...document.querySelectorAll('button')].map((b) => ({
    t: txt(b), cls: (b.className || '').toString().slice(0, 40), disabled: b.disabled,
  })).filter((x) => x.t);
  const tabs = [...document.querySelectorAll('.dt-tab, .rail-status-tab, .status-tab')].map(txt);
  return {
    hash: location.hash,
    docNo: (document.body.innerText.match(/SJ[-\w]+/) || [''])[0],
    hasSheet: !!document.querySelector('.fi-sheet'),
    editableInputs: document.querySelectorAll('.fi-sheet input').length,
    tabs,
    btns: btns.slice(0, 40),
    bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-06-panel.png', fullPage: true });
