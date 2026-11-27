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
  await page.waitForTimeout(900);
}

// 勾一张(冠霖)让工具栏可用 → 合单生单
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const tr = [...document.querySelectorAll('tr')].find((x) => tt(x).includes('YJ-20261014-03') && x.querySelector('.el-checkbox'));
  if (tr) tr.querySelector('.el-checkbox').click();
});
await page.waitForTimeout(700);
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const g = [...document.querySelectorAll('.tb-group')].find((x) => tt(x.querySelector('.act-name')) === '生单');
  if (g) g.querySelector('.tb-caret').click();
});
await page.waitForTimeout(900);
await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const m = [...document.querySelectorAll('.tb-menu')].find((el) => el.offsetParent !== null && /合单生单/.test(tt(el)));
  const item = m && [...m.querySelectorAll('*')].find((el) => el.children.length === 0 && tt(el) === '合单生单');
  if (item) item.click();
});
await page.waitForTimeout(6000);

// 在选单弹窗里翻页找另一张冠霖的单并「可加入」
const added = await page.evaluate(async () => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const dlgOf = () => [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test(tt(d)));
  const seen = [];
  for (let p = 0; p < 6; p++) {
    const dlg = dlgOf();
    if (!dlg) return { ok: false, note: '选单弹窗关了', seen };
    const trs = [...dlg.querySelectorAll('tbody tr')];
    for (const tr of trs) {
      const s = tt(tr);
      if (/YJ-2026/.test(s) && /冠霖/.test(s)) seen.push(s.slice(0, 40));
    }
    const hit = trs.find((tr) => /冠霖/.test(tt(tr)) && !/YJ-20261014-03/.test(tt(tr)));
    if (hit) {
      const btn = [...hit.querySelectorAll('button, span, div')].find((el) => tt(el) === '可加入');
      if (btn) { btn.click(); await sleep(1200); return { ok: true, added: tt(hit).slice(0, 50), seen }; }
    }
    const next = [...dlg.querySelectorAll('button')].find((b) => /下一页/.test(tt(b)) && !b.disabled);
    if (!next) break;
    next.click();
    await sleep(2200);
  }
  return { ok: false, seen };
});
console.log('翻页加单:', JSON.stringify(added).slice(0, 500));
await page.waitForTimeout(1200);
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
  const msg = [...document.querySelectorAll('.el-message')].map(tt);
  return {
    titles: dlgs.map((d) => tt(d.querySelector('.el-dialog__title')).slice(0, 30)),
    msg,
  };
});
console.log(JSON.stringify(info));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/gl-kingdee-unrecv-20261127/r16-merge.png' });
