const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
const t = (s) => s;

// 关掉所有弹窗
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null);
    if (!dlg) return;
    const btn = [...dlg.querySelectorAll('button')].find((b) => /取消|关闭/.test((b.innerText || '')));
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);
}

// 进列表页(不带 docNo)
await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER', { timeout: 60000 });
await page.waitForTimeout(7000);

// 模糊搜索「冠霖」并查询
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('模糊搜索'));
  if (inp) setVal(inp, '冠霖');
});
await page.waitForTimeout(600);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button, .el-button')].find((b) => /查找/.test((b.innerText || '')));
  if (btn) btn.click();
});
await page.waitForTimeout(4500);

// 勾两张冠霖的订单
const picked = await page.evaluate(() => {
  const want = ['YJ-20261014-03', 'YJ-20261121-07'];
  const out = [];
  for (const no of want) {
    const tr = [...document.querySelectorAll('tr')].find((x) => (x.innerText || '').includes(no) && x.querySelector('.el-checkbox'));
    if (!tr) { out.push(no + ':缺'); continue; }
    tr.querySelector('.el-checkbox').click();
    out.push(no + ':勾');
  }
  return out;
});
console.log('勾选:', JSON.stringify(picked));
await page.waitForTimeout(1200);

// 生单▼ → 合单生单
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => tt(x.querySelector('.act-name')) === '生单');
  if (g) g.querySelector('.tb-caret').click();
});
await page.waitForTimeout(1200);
const menu = await page.evaluate(() => [...document.querySelectorAll('.tb-menu')].filter((el) => el.offsetParent !== null).map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()));
console.log('菜单:', JSON.stringify(menu));
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const m = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null && /合单生单/.test(tt(el)));
  const item = m && [...m.querySelectorAll('*')].find((el) => el.children.length === 0 && tt(el) === '合单生单');
  if (item) item.click();
});
await page.waitForTimeout(8000);

const info = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null);
  if (!dlg) return { ok: false };
  const tables = [...dlg.querySelectorAll('table')];
  const headTb = tables.find((x) => x.querySelectorAll('thead th').length);
  const head = headTb ? [...headTb.querySelectorAll('thead th')].map((x) => tt(x)) : [];
  const flat = tables.filter((x) => x.querySelectorAll('tbody tr').length)
    .flatMap((x) => [...x.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((y) => tt(y))));
  const idx = { 行号: head.indexOf('行号'), 物料: head.indexOf('物料编码'), 数量: head.indexOf('数量'), 剩余: head.indexOf('剩余'), 已入: head.indexOf('金蝶已入库'), 未入: head.indexOf('金蝶未入库'), 上限: head.indexOf('可生单') };
  const line = (r) => `${r[idx['行号']]} ${r[idx['物料']]} 数=${r[idx['数量']]} 剩=${r[idx['剩余']]} 金蝶已入=${r[idx['已入']]} 金蝶未入=${r[idx['未入']]} 可生单=${r[idx['上限']]}`;
  return {
    ok: true,
    title: tt(dlg.querySelector('.el-dialog__title')),
    tip: [...dlg.querySelectorAll('.gl-jd-tip')].map(tt),
    head,
    rows: flat.length,
    gl008: flat.filter((r) => /YJ-GL-008/.test(r.join('|'))).map(line),
    sample: flat.slice(0, 2).map(line),
    warn: [...dlg.querySelectorAll('.gl-jd-short')].map(tt).slice(0, 6),
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 6000));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r11-merge.png' });
