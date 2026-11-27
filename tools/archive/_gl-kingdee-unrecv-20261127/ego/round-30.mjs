const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');

// 重新打开选单弹窗
await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER?docNo=YJ-20261014-03', { timeout: 60000 });
await page.waitForTimeout(7000);
for (let i = 0; i < 3; i++) {
  const closed = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null);
    if (!dlg) return false;
    const btn = [...dlg.querySelectorAll('button')].find((b) => /取消|关闭/.test((b.innerText || '')));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!closed) break;
  await page.waitForTimeout(800);
}
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => tt(x.querySelector('.act-name')) === '生单');
  if (g) g.querySelector('.tb-caret').click();
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const m = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null && /合单生单/.test(tt(el)));
  const item = m && [...m.querySelectorAll('*')].find((el) => el.children.length === 0 && tt(el) === '合单生单');
  if (item) item.click();
});
await page.waitForTimeout(6000);

// 依次勾两行，每勾一行读一次「已选」
const log = [];
for (const no of ['YJ-20261120-07', 'YJ-20261120-01']) {
  const r = await page.evaluate((target) => {
    const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
    const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(tt(d)));
    if (!dlg) return { ok: false };
    const tr = [...dlg.querySelectorAll('tbody tr')].find((x) => tt(x).includes(target));
    if (!tr) return { ok: false, note: 'no row' };
    const inner = tr.querySelector('.el-checkbox__inner');
    if (inner) inner.click();
    return { ok: true, picked: tt(dlg.querySelector('.mpd-picked')) };
  }, no);
  log.push({ no, r });
  await page.waitForTimeout(900);
}
console.log(JSON.stringify(log, null, 1));
const final = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(tt(d)));
  return dlg ? tt(dlg.querySelector('.mpd-picked')) : '';
});
console.log('最终已选:', final);
