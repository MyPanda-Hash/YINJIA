const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
await page.waitForTimeout(1500);

// 用 JS 精确点「工厂名」那个（同名的还有一个语言开关，选择器会歧义）
const opened = await page.evaluate(() => {
  const els = [...document.querySelectorAll('span.factory-name')];
  const el = els.find((x) => /YINJIA/i.test(x.innerText || '')) || els[0];
  if (!el) return { ok: false };
  el.click();
  return { ok: true, text: (el.innerText || '').trim(), count: els.length };
});
console.log('点工厂名:', JSON.stringify(opened));
await page.waitForTimeout(1500);

const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item')]
  .map((el, i) => ({ i, text: (el.innerText || '').trim() })));
console.log('下拉项:', JSON.stringify(items));

const target = items.find((x) => /测试库/.test(x.text));
if (target) {
  await page.evaluate((i) => {
    [...document.querySelectorAll('.el-dropdown-menu__item')][i].click();
  }, target.i);
  await page.waitForTimeout(10000);
}
const after = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span.factory-name')].find((x) => /YINJIA/i.test(x.innerText || ''));
  return {
    hash: location.hash,
    factory: el ? (el.innerText || '').trim() : '(找不到)',
    onLogin: location.hash.includes('login'),
    bodyTop: (document.body.innerText || '').slice(0, 200),
  };
});
console.log('切换后:', JSON.stringify(after, null, 1));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r10-factory-test.png' });
