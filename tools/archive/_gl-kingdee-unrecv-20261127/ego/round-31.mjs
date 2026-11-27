const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(tt(d)));
  const btn = dlg && [...dlg.querySelectorAll('button')].find((b) => /加入合单/.test(tt(b)));
  if (btn && !/is-disabled/.test(btn.className)) btn.click();
});
await page.waitForTimeout(10000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }

const info = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlgs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null);
  const dlg = dlgs.find((d) => /合单生单/.test(tt(d.querySelector('.el-dialog__title')))) || dlgs[dlgs.length - 1];
  const out = { titles: dlgs.map((d) => tt(d.querySelector('.el-dialog__title')).slice(0, 28)), msg: [...document.querySelectorAll('.el-message')].map(tt) };
  if (!dlg) return { ...out, ok: false };
  const tables = [...dlg.querySelectorAll('table')];
  const headTb = tables.find((x) => x.querySelectorAll('thead th').length);
  const head = headTb ? [...headTb.querySelectorAll('thead th')].map((x) => tt(x)) : [];
  const flat = tables.filter((x) => x.querySelectorAll('tbody tr').length)
    .flatMap((x) => [...x.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((y) => tt(y))));
  const idx = { 行号: head.indexOf('行号'), 物料: head.indexOf('物料编码'), 数量: head.indexOf('数量'), 剩余: head.indexOf('剩余'), 已入: head.indexOf('金蝶已入库'), 未入: head.indexOf('金蝶未入库') };
  const line = (r) => `${r[idx['行号']]} ${r[idx['物料']]} 数=${r[idx['数量']]} 剩=${r[idx['剩余']]} 已入=${r[idx['已入']]} 未入=${r[idx['未入']]}`;
  return {
    ...out, ok: true,
    title: tt(dlg.querySelector('.el-dialog__title')),
    head, rows: flat.length,
    sample: flat.slice(0, 4).map(line),
    warn: dlg.querySelectorAll('.gl-jd-short').length,
    tip: [...dlg.querySelectorAll('.gl-jd-tip')].map(tt).slice(0, 1),
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 4000));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r31-merge.png' });
