const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { }
const st = await page.evaluate(() => ({
  headProduct: (() => { const tds = [...document.querySelectorAll('td.rs-label')]; const td = tds.find(t => (t.textContent || '').trim() === '产品编号'); const ref = td && td.nextElementSibling.querySelector('.rs-ref-ctl'); return ref ? (ref.textContent || '').trim() : null; })(),
  stage: [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^(草稿|审批中|已归档)$/.test((e.textContent || '').trim())).map(e => (e.textContent || '').trim()),
}));
console.log(JSON.stringify(st));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r42-three-plans.png' });
