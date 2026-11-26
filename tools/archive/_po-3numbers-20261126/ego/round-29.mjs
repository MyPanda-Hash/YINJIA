const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const log = (m) => console.log(m);

// 弃审
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '审批');
  g.querySelector('.tb-caret').click();
});
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const menu = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null && /弃审/.test(t(el)));
  [...menu.querySelectorAll('*')].find((el) => el.children.length === 0 && t(el) === '弃审').click();
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const box = [...document.querySelectorAll('.el-message-box')].find((el) => el.offsetParent !== null);
  [...box.querySelectorAll('button')].find((b) => /确定/.test(t(b))).click();
});

// 立刻截：先拿提示的位置，再马上截图
await page.waitForTimeout(600);
const rect = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.el-message')].find((x) => x.offsetParent !== null);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { text: (el.innerText || '').trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), z: getComputedStyle(el).zIndex };
});
log('提示框位置: ' + JSON.stringify(rect));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r29-toast.png' });
if (rect && rect.w > 0) {
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r29-toast-clip.png', clip: { x: Math.max(0, rect.x - 10), y: Math.max(0, rect.y - 10), width: rect.w + 20, height: rect.h + 20 } });
}

// 复核回去
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '审核');
  g.querySelector('.tb-main').click();
});
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const box = [...document.querySelectorAll('.el-message-box')].find((el) => el.offsetParent !== null);
  if (!box) return;
  const btn = [...box.querySelectorAll('button')].find((b) => /确认审核/.test(t(b)));
  if (btn) btn.click();
});
await page.waitForTimeout(5000);
const st = await page.evaluate(() => (document.querySelector('.doc-status') || {}).innerText || '');
log('最终状态: ' + st);
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r29-final.png' });
