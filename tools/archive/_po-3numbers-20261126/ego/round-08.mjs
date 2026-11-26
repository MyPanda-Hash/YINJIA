const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
await page.goto('http://36.140.66.163:8090/#/dashboard', { timeout: 60000 });
await page.waitForTimeout(6000);
const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const hits = [...document.querySelectorAll('*')]
    .filter((el) => el.children.length <= 3 && /YINJIA-MES/.test(txt(el)) && txt(el).length < 40)
    .slice(0, 8)
    .map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 60), text: txt(el) }));
  return { hash: location.hash, hasToken: !!localStorage.getItem('token'), hits };
});
console.log(JSON.stringify(info, null, 1));
