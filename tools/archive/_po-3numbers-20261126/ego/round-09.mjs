const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
await page.waitForTimeout(2000);

// 打开工厂下拉
await page.click('span.factory-name', { label: '切换工厂' });
await page.waitForTimeout(1200);
const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .el-select-dropdown__item')]
  .map((el, i) => ({ i, text: (el.innerText || '').trim(), cls: el.className })));
console.log('下拉项:', JSON.stringify(items));

// 选「测试库」
const target = items.find((x) => /测试库/.test(x.text));
if (!target) { console.log('没找到测试库选项'); } else {
  await page.evaluate((idx) => {
    const els = [...document.querySelectorAll('.el-dropdown-menu__item, .el-select-dropdown__item')];
    els[idx].click();
  }, target.i);
  await page.waitForTimeout(9000);
  const after = await page.evaluate(() => ({
    hash: location.hash,
    factory: (document.querySelector('span.factory-name') || {}).innerText || '',
    onLogin: location.hash.includes('login'),
    bodyTop: (document.body.innerText || '').slice(0, 160),
  }));
  console.log('切换后:', JSON.stringify(after, null, 1));
}
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r09-factory.png' });
