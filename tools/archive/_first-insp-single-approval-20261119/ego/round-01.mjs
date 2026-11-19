const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 });
await page.waitForTimeout(3500);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
const info = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('input')].map((i) => ({
    ph: i.placeholder || '', type: i.type, val: i.value, cls: (i.className || '').slice(0, 60),
  }));
  const selects = [...document.querySelectorAll('.el-select, select')].map((s) => ({
    txt: (s.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60), cls: (s.className || '').slice(0, 40),
  }));
  const btns = [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  return {
    hash: location.hash,
    title: document.title,
    bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
    ins, selects, btns: btns.slice(0, 20),
    hasSheet: !!document.querySelector('.fi-sheet'),
  };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-01-login.png' });
console.log({ screenshot: shot });
