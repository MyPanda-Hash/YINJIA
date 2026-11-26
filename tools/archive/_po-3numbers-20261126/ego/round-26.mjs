const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');

// 复核回去：点「审核」
const r = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '审核');
  if (!g) return { ok: false };
  const main = g.querySelector('.tb-main');
  if (/disabled/.test(main.className)) return { ok: false, reason: '审核按钮禁用' };
  main.click();
  return { ok: true };
});
console.log('点审核:', JSON.stringify(r));
await page.waitForTimeout(2500);

// 若有确认框则确定
const box = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const b = [...document.querySelectorAll('.el-message-box')].find((el) => el.offsetParent !== null);
  if (!b) return { box: null };
  const btn = [...b.querySelectorAll('button')].find((x) => /确定/.test(t(x)));
  if (btn) btn.click();
  return { box: t(b) };
});
console.log('确认框:', JSON.stringify(box));
await page.waitForTimeout(5000);

const after = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return {
    messages: [...document.querySelectorAll('.el-message, .el-notification')].map(t),
    status: t(document.querySelector('.doc-status')),
    tags: [...document.querySelectorAll('.dsr-tag')].map(t),
  };
});
console.log('复核后:', JSON.stringify(after));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r26-reaudit.png' });
