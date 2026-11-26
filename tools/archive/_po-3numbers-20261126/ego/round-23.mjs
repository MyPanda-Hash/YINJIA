const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const r = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '审批');
  const caret = g && g.querySelector('.tb-caret');
  if (!caret) return { ok: false };
  caret.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  caret.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  caret.click();
  return { ok: true, caretCls: caret.className };
});
console.log('点审批▼:', JSON.stringify(r));
await page.waitForTimeout(1500);
const dump = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return [...document.querySelectorAll('[class*="pop"],[class*="menu"],[class*="drop"]')]
    .filter((el) => el.offsetParent !== null)
    .map((el) => ({ cls: String(el.className).slice(0, 50), text: t(el).slice(0, 160) }))
    .filter((x) => x.text)
    .slice(0, 12);
});
console.log(JSON.stringify(dump, null, 1));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r23-approve-menu.png' });
