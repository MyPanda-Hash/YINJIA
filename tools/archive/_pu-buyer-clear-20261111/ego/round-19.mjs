// round-19: 回归——重开弹窗(默认应仍是名单第一条) → 重打 → 纸面需方框仍是孙郝聪/13718162430
const task = await taskSpace(3);
const page = task.page('p1');

// 关掉当前弹窗
await page.evaluate(() => {
  const closeBtn = document.querySelector('.el-dialog__headerbtn');
  if (closeBtn) closeBtn.click();
});
await page.waitForTimeout(1200);

// 重新打开(工具栏「打印」主动作 = 有金额打印弹窗)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-main')].find((e) => (e.textContent || '').trim() === '打印');
  if (el) el.click();
});
await page.waitForTimeout(4500);

const dlg = await page.evaluate(() => ({
  open: !!document.querySelector('.pup'),
  name: (document.querySelector('.pup-buyer-sel')?.innerText || '').replace(/\s+/g, ' ').trim(),
  tel: (document.querySelector('.pup-buyer-tel')?.innerText || '').replace(/\s+/g, ' ').trim(),
  clearDisabled: (() => {
    const b = [...document.querySelectorAll('.pup-buyer button')].find((x) => (x.textContent || '').trim() === '清空');
    return b ? b.disabled : null;
  })(),
}));
console.log('reopened:', JSON.stringify(dlg));

await page.evaluate(() => {
  window.__paperHtml = null;
  window.print = () => {
    const host = document.getElementById('yj-print-host');
    window.__paperHtml = host ? host.innerHTML : 'no-host';
  };
});
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.pup-rec button')].find((b) => (b.textContent || '').trim() === '重打');
  if (!btn) return 'no-btn';
  btn.click();
  return 'clicked';
});
console.log('重打:', clicked);
await page.waitForTimeout(4500);
const paper = await page.evaluate(() => {
  const html = window.__paperHtml;
  if (!html) return { paper: null };
  const div = document.createElement('div');
  div.innerHTML = html;
  return { title: div.querySelector('h1')?.textContent, boxes: [...div.querySelectorAll('.sign .box')].map((b) => b.innerHTML.replace(/\s+/g, ' ').trim()) };
});
console.log(JSON.stringify(paper, null, 2));
