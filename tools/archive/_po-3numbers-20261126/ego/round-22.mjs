const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
const txt = () => {};
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => t(x.querySelector('.act-name')) === '更多');
  g.querySelector('.tb-main').click();
});
await page.waitForTimeout(1500);
const dump = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const cands = [...document.querySelectorAll('[class*="popper"],[class*="dropdown"],[class*="menu"],[role="menu"],[class*="pop"]')]
    .filter((el) => el.offsetParent !== null && t(el).length > 0 && t(el).length < 400);
  return cands.map((el) => ({ cls: String(el.className).slice(0, 60), text: t(el).slice(0, 200) })).slice(0, 10);
});
console.log(JSON.stringify(dump, null, 1));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r22-more.png' });
