// round-12: 关掉管理名单 → 确认两个字段是空的 → 覆盖 window.print → 点「确定并打印」→ 读纸面需方框
const task = await taskSpace(3);
const page = task.page('p1');

// 关掉管理名单(取消)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('需方联系人名单'));
  if (!dlg) return;
  const cancel = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '取消');
  if (cancel) cancel.click();
});
await page.waitForTimeout(800);

const before = await page.evaluate(() => ({
  name: (document.querySelector('.pup-buyer-sel')?.innerText || '').replace(/\s+/g, ' ').trim(),
  tel: (document.querySelector('.pup-buyer-tel')?.innerText || '').replace(/\s+/g, ' ').trim(),
}));
console.log('fields before print:', JSON.stringify(before));

// 拦掉原生打印对话框(只为取证纸面 HTML)
await page.evaluate(() => {
  window.__printed = 0;
  window.print = () => { window.__printed += 1; };
});

const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('确定并打印'));
  if (!btn) return 'no-btn';
  btn.click();
  return 'clicked';
});
console.log('print btn:', clicked);
await page.waitForTimeout(4000);

const paper = await page.evaluate(() => {
  const host = document.getElementById('yj-print-host');
  if (!host) return { host: false };
  const sign = host.querySelector('.sign');
  return {
    host: true,
    printed: window.__printed || 0,
    signHtml: sign ? sign.innerHTML.replace(/\s+/g, ' ').trim() : null,
    title: (host.querySelector('h1')?.textContent || '').trim(),
  };
});
console.log(JSON.stringify(paper, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-12-before-print.png' });
