const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');

// 关弹窗
for (let i = 0; i < 4; i++) {
  const closed = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null);
    if (!dlg) return false;
    const btn = [...dlg.querySelectorAll('button')].find((b) => /取消|关闭/.test((b.innerText || '')));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!closed) break;
  await page.waitForTimeout(900);
}

// 列表页:清掉搜索,勾两张「惠州市双喜」的订单
await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER', { timeout: 60000 });
await page.waitForTimeout(7000);
const picked = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const rows = [...document.querySelectorAll('tr')].filter((tr) => tr.querySelector('.el-checkbox') && /已审核/.test(tt(tr)));
  const out = [];
  for (const tr of rows) {
    if (!/双喜/.test(tt(tr))) continue;
    if (out.length >= 2) break;
    tr.querySelector('.el-checkbox').click();
    out.push(tt(tr).slice(0, 40));
  }
  return out;
});
console.log('勾选:', JSON.stringify(picked));
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => tt(x.querySelector('.act-name')) === '生单');
  if (g) g.querySelector('.tb-caret').click();
});
await page.waitForTimeout(1000);
const menu = await page.evaluate(() => [...document.querySelectorAll('.tb-menu')].filter((el) => el.offsetParent !== null).map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()));
console.log('菜单:', JSON.stringify(menu));
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const m = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null && /合单生单/.test(tt(el)));
  const item = m && [...m.querySelectorAll('*')].find((el) => el.children.length === 0 && tt(el) === '合单生单');
  if (item) item.click();
});
await page.waitForTimeout(9000);
const info = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return {
    titles: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => tt(d.querySelector('.el-dialog__title')).slice(0, 30)),
    msg: [...document.querySelectorAll('.el-message')].map(tt),
  };
});
console.log(JSON.stringify(info));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r17-merge.png' });
