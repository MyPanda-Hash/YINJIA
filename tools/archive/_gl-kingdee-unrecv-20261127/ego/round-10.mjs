const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');

// 在「选择采购订单」里勾 YJ-20261121-07（同为冠霖，第二张单）
const r = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(t(d)));
  if (!dlg) return { ok: false, note: '没有选单弹窗' };
  const tr = [...dlg.querySelectorAll('tr')].find((x) => t(x).includes('YJ-20261121-07'));
  if (!tr) return { ok: false, note: '没找到该行' };
  const cb = tr.querySelector('.el-checkbox');
  if (cb) cb.click();
  return { ok: true, row: t(tr).slice(0, 60) };
});
console.log('勾单:', JSON.stringify(r));
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(t(d)));
  const btn = dlg && [...dlg.querySelectorAll('button')].find((b) => /加入合单/.test(t(b)));
  if (btn) btn.click();
});
await page.waitForTimeout(7000);

const info = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && !/选择采购订单/.test(t(d)));
  if (!dlg) return { ok: false, note: '没有合单对话框' };
  const tables = [...dlg.querySelectorAll('table')];
  const headTb = tables.find((x) => x.querySelectorAll('thead th').length);
  const head = headTb ? [...headTb.querySelectorAll('thead th')].map((x) => t(x)) : [];
  const bodies = tables.filter((x) => x.querySelectorAll('tbody tr').length)
    .map((x) => [...x.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((y) => t(y))));
  const flat = bodies.flat();
  const idx = { 行号: head.indexOf('行号'), 物料: head.indexOf('物料编码'), 数量: head.indexOf('数量'), 剩余: head.indexOf('剩余'), 已入: head.indexOf('金蝶已入库'), 未入: head.indexOf('金蝶未入库') };
  const line = (r) => `${r[idx['行号']]} ${r[idx['物料']]} 数=${r[idx['数量']]} 剩=${r[idx['剩余']]} 金蝶已入=${r[idx['已入']]} 金蝶未入=${r[idx['未入']]}`;
  return {
    ok: true,
    title: t(dlg.querySelector('.el-dialog__title')),
    tip: [...dlg.querySelectorAll('.gl-jd-tip')].map(t),
    head,
    gl008: flat.filter((r) => /YJ-GL-008/.test(r.join('|'))).map(line),
    first2: flat.slice(0, 2).map(line),
    warn: [...dlg.querySelectorAll('.gl-jd-short')].map(t).slice(0, 6),
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 5000));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r10-merge-dialog.png' });
