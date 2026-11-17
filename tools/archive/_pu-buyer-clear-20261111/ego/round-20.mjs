// round-20: 管理名单保存能不能真的落库(5173 → 运行中的 8090 后端;若 jar 没编进 PUT 就会 405)
const task = await taskSpace(3);
const page = task.page('p1');

async function clickText(sel, text) {
  return page.evaluate(({ sel, text }) => {
    const btn = [...document.querySelectorAll(sel)].find((b) => (b.textContent || '').trim() === text);
    if (!btn) return 'no-btn';
    btn.click();
    return 'ok';
  }, { sel, text });
}

console.log('open mgr:', await clickText('.pup-buyer-mgr', '管理名单'));
await page.waitForTimeout(1200);
console.log('add row:', await clickText('.pup-mgr-add button', '＋ 新增一行'));
await page.waitForTimeout(600);
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.pup-mgr-row')];
  const last = rows[rows.length - 1];
  const ins = last.querySelectorAll('input');
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  setVal(ins[0], '探针小李');
  setVal(ins[1], '13900000000');
});
await page.waitForTimeout(400);
const before = await page.evaluate(() => [...document.querySelectorAll('.pup-mgr-row')].map((r) => [...r.querySelectorAll('input')].map((i) => i.value)));
console.log('rows before save:', JSON.stringify(before));

console.log('save:', await clickText('.el-dialog button', '保存名单'));
await page.waitForTimeout(3500);
const after = await page.evaluate(() => ({
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
  mgrOpen: !!document.querySelector('.pup-mgr-row'),
  rowCount: document.querySelectorAll('.pup-mgr-row').length,
}));
console.log('after save:', JSON.stringify(after));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-20-mgrsave.png' });
