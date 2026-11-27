const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');

// 关掉所有对话框
for (let i = 0; i < 4; i++) {
  const closed = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null);
    if (!dlg) return false;
    const btn = [...dlg.querySelectorAll('button')].find((b) => /取消|关闭/.test((b.innerText || '')));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!closed) break;
  await page.waitForTimeout(1000);
}

// 重新触发 合单生单（列表里先勾一张，让工具栏可用）
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const tr = [...document.querySelectorAll('tr')].find((x) => tt(x).includes('YJ-20261014-03') && x.querySelector('.el-checkbox'));
  if (tr) tr.querySelector('.el-checkbox').click();
});
await page.waitForTimeout(800);
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => tt(x.querySelector('.act-name')) === '生单');
  if (g) g.querySelector('.tb-caret').click();
});
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const m = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null && /合单生单/.test(tt(el)));
  const item = m && [...m.querySelectorAll('*')].find((el) => el.children.length === 0 && tt(el) === '合单生单');
  if (item) item.click();
});
await page.waitForTimeout(6000);

// 选单弹窗里「可加入」两张同一供应商(无锡安吉)的单
const added = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(tt(d)));
  if (!dlg) return { ok: false, dialogs: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => tt(d.querySelector('.el-dialog__title'))) };
  const out = [];
  for (const no of ['YJ-20261120-07', 'YJ-20261120-01']) {
    const tr = [...dlg.querySelectorAll('tr')].find((x) => tt(x).includes(no));
    const btn = tr && [...tr.querySelectorAll('button, span, div')].find((el) => tt(el) === '可加入');
    if (btn) { btn.click(); out.push(no); }
  }
  return { ok: true, added: out };
});
console.log('加入:', JSON.stringify(added));
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(tt(d)));
  const btn = dlg && [...dlg.querySelectorAll('button')].find((b) => /加入合单/.test(tt(b)));
  if (btn) btn.click();
});
await page.waitForTimeout(9000);

const info = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlgs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null);
  const target = dlgs.find((d) => /合单生单|生单/.test(tt(d.querySelector('.el-dialog__title'))) && !/选择采购订单/.test(tt(d.querySelector('.el-dialog__title'))));
  const dlg = target || dlgs[0];
  if (!dlg) return { ok: false, titles: [] };
  const tables = [...dlg.querySelectorAll('table')];
  const headTb = tables.find((x) => x.querySelectorAll('thead th').length);
  const head = headTb ? [...headTb.querySelectorAll('thead th')].map((x) => tt(x)) : [];
  const flat = tables.filter((x) => x.querySelectorAll('tbody tr').length)
    .flatMap((x) => [...x.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((y) => tt(y))));
  const idx = { 行号: head.indexOf('行号'), 物料: head.indexOf('物料编码'), 数量: head.indexOf('数量'), 剩余: head.indexOf('剩余'), 已入: head.indexOf('金蝶已入库'), 未入: head.indexOf('金蝶未入库'), 可生: head.indexOf('可生单') };
  const line = (r) => `${r[idx['行号']]} ${r[idx['物料']]} 数=${r[idx['数量']]} 剩=${r[idx['剩余']]} 已入=${r[idx['已入']]} 未入=${r[idx['未入']]} 可生单=${r[idx['可生']]}`;
  return {
    ok: true,
    titles: dlgs.map((d) => tt(d.querySelector('.el-dialog__title')).slice(0, 30)),
    title: tt(dlg.querySelector('.el-dialog__title')),
    tip: [...dlg.querySelectorAll('.gl-jd-tip')].map(tt).slice(0, 2),
    head,
    rows: flat.length,
    sample: flat.slice(0, 3).map(line),
    warnCount: dlg.querySelectorAll('.gl-jd-short').length,
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 5000));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r15-merge-final.png' });
