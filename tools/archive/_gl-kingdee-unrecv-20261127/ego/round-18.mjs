const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
const r = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(tt(d)));
  if (!dlg) return { ok: false };
  const trs = [...dlg.querySelectorAll('tbody tr')];
  const want = ['YJ-20261120-07', 'YJ-20261120-01'];
  const done = [];
  for (const no of want) {
    const tr = trs.find((x) => tt(x).includes(no));
    const cb = tr && tr.querySelector('.el-checkbox');
    if (cb) { cb.click(); done.push(no); }
  }
  return { ok: true, done };
});
console.log('勾两行:', JSON.stringify(r));
await page.waitForTimeout(1400);
const sel = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(tt(d)));
  return tt(dlg.querySelector('.el-dialog__footer, [class*="foot"]')).slice(0, 80);
});
console.log('已选:', JSON.stringify(sel));
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
  const dlg = dlgs.find((d) => /合单/.test(tt(d.querySelector('.el-dialog__title')))) || dlgs[0];
  const tables = dlg ? [...dlg.querySelectorAll('table')] : [];
  const headTb = tables.find((x) => x.querySelectorAll('thead th').length);
  const head = headTb ? [...headTb.querySelectorAll('thead th')].map((x) => tt(x)) : [];
  const flat = tables.filter((x) => x.querySelectorAll('tbody tr').length)
    .flatMap((x) => [...x.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((y) => tt(y))));
  const idx = { 行号: head.indexOf('行号'), 物料: head.indexOf('物料编码'), 数量: head.indexOf('数量'), 剩余: head.indexOf('剩余'), 已入: head.indexOf('金蝶已入库'), 未入: head.indexOf('金蝶未入库') };
  const line = (r) => `${r[idx['行号']]} ${r[idx['物料']]} 数=${r[idx['数量']]} 剩=${r[idx['剩余']]} 已入=${r[idx['已入']]} 未入=${r[idx['未入']]}`;
  return {
    titles: dlgs.map((d) => tt(d.querySelector('.el-dialog__title')).slice(0, 30)),
    title: dlg ? tt(dlg.querySelector('.el-dialog__title')) : '',
    msg: [...document.querySelectorAll('.el-message')].map(tt),
    head,
    rows: flat.length,
    sample: flat.slice(0, 3).map(line),
    warnCount: dlg ? dlg.querySelectorAll('.gl-jd-short').length : 0,
    tip: dlg ? [...dlg.querySelectorAll('.gl-jd-tip')].map(tt) : [],
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 5000));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r18-merge.png' });
