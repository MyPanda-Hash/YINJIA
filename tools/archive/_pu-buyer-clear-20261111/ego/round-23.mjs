// round-23: 8090 打包版复验:打开采购订单 → 有金额打印弹窗 → 看「清空」在不在 → 清空 → 重打 → 纸面需方框应为空
const task = await taskSpace(3);
const page = task.page('p1');

await page.dblclick('tbody tr:has-text("PO-2026-11-0012")', { label: '打开采购订单' });
await page.waitForTimeout(4500);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-main')].find((e) => (e.textContent || '').trim() === '打印');
  if (el) el.click();
});
await page.waitForTimeout(5000);

const dlg = await page.evaluate(() => {
  const pup = document.querySelector('.pup');
  if (!pup) return { open: false };
  return {
    open: true,
    tip: (document.querySelector('.pup-buyer-tip')?.innerText || '').replace(/\s+/g, ' ').trim(),
    buttons: [...document.querySelectorAll('.pup-buyer button')].map((b) => ({ t: (b.textContent || '').trim(), disabled: b.disabled })),
    name: (document.querySelector('.pup-buyer-sel')?.innerText || '').replace(/\s+/g, ' ').trim(),
    tel: (document.querySelector('.pup-buyer-tel')?.innerText || '').replace(/\s+/g, ' ').trim(),
  };
});
console.log('8090 dialog:', JSON.stringify(dlg, null, 2));

// 清空
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.pup-buyer button')].find((x) => (x.textContent || '').trim() === '清空');
  if (b) b.click();
});
await page.waitForTimeout(600);
const cleared = await page.evaluate(() => ({
  name: (document.querySelector('.pup-buyer-sel')?.innerText || '').replace(/\s+/g, ' ').trim(),
  tel: (document.querySelector('.pup-buyer-tel')?.innerText || '').replace(/\s+/g, ' ').trim(),
}));
console.log('8090 after clear:', JSON.stringify(cleared));

// 拦原生打印 → 点「确定并打印」(会改成"重打"取证不新增记录:先看有没有记录)
await page.evaluate(() => {
  window.__paperHtml = null;
  window.print = () => {
    const host = document.getElementById('yj-print-host');
    window.__paperHtml = host ? host.innerHTML : 'no-host';
  };
});
const which = await page.evaluate(() => {
  const reprint = [...document.querySelectorAll('.pup-rec button')].find((b) => (b.textContent || '').trim() === '重打');
  const main = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('确定并打印'));
  if (reprint) { reprint.click(); return '重打'; }
  if (main) { main.click(); return '确定并打印'; }
  return 'no-btn';
});
console.log('8090 button used:', which);
await page.waitForTimeout(5000);
const paper = await page.evaluate(() => {
  const html = window.__paperHtml;
  if (!html) return { paper: null };
  const div = document.createElement('div');
  div.innerHTML = html;
  return { title: div.querySelector('h1')?.textContent, boxes: [...div.querySelectorAll('.sign .box')].map((b) => b.innerHTML.replace(/\s+/g, ' ').trim()) };
});
console.log('8090 paper:', JSON.stringify(paper, null, 2));
