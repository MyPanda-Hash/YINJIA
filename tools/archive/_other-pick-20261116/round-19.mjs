const task = await taskSpace("start-system-20261110");
const page = task.page("p1");

const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) { console.log("restore skip: " + e.message); }
};

const scanExpr = (code) => `(() => {
  const el = document.querySelector('.mo-scanbar input');
  if (!el) return 'no-input';
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(el, ${JSON.stringify(code)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  return 'ok';
})()`

const setQtyExpr = (v) => `(() => {
  const el = document.querySelector('.mo-qty input');
  if (!el) return 'no-qty-input';
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(el, ${JSON.stringify(String(v))});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.blur();
  return 'ok';
})()`

const addExpr = `(() => {
  const b = [...document.querySelectorAll('.mo-qty button')].find((x) => (x.textContent || '').includes('加入清单'));
  if (!b) return 'no-btn';
  b.click();
  return 'ok';
})()`

const readExpr = `(() => ({
  lines: [...document.querySelectorAll('.mo-line')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  err: (document.querySelector('.el-alert__title')?.textContent || '').trim(),
  cand: [...document.querySelectorAll('.mo-cand')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  needWh: !!document.querySelector('.mo-wh'),
  scanText: document.querySelector('.mo-scanbar input')?.value || '',
}))()`

const submitExpr = `(() => {
  const b = [...document.querySelectorAll('.mo-foot button')].find((x) => (x.textContent || '').trim() === '提交');
  if (!b) return 'no-submit';
  b.click();
  return 'ok';
})()`

await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET", { timeout: 40000 });
await page.waitForTimeout(7000);
await restore();
console.log('PAGE ' + JSON.stringify(await page.evaluate(`(() => ({
  title: document.title,
  hash: location.hash,
  body: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 260),
}))()`), null, 2));

// ① 有库存的物料(HP-08):走正常路径
console.log('SCAN1 ' + await page.evaluate(scanExpr('HP-08')));
await page.waitForTimeout(4000);
console.log('CAND1 ' + JSON.stringify(await page.evaluate(readExpr), null, 2));
console.log('QTY1 ' + await page.evaluate(setQtyExpr(4)));
await page.waitForTimeout(700);
console.log('ADD1 ' + await page.evaluate(addExpr));
await page.waitForTimeout(1800);
console.log('LIST1 ' + JSON.stringify(await page.evaluate(readExpr), null, 2));

// ② 没库存的物料(C-53-02):应走「查商品档案 + 手选退到仓库」兜底
console.log('SCAN2 ' + await page.evaluate(scanExpr('C-53-02')));
await page.waitForTimeout(4500);
const cand2 = await page.evaluate(readExpr);
console.log('CAND2 ' + JSON.stringify(cand2, null, 2));

// 手选仓库:点开下拉选第一个
const pickWh = await page.evaluate(`(() => {
  const sel = document.querySelector('.mo-wh .el-select');
  if (!sel) return 'no-select';
  sel.click();
  return 'ok';
})()`);
console.log('WH_CLICK ' + pickWh);
await page.waitForTimeout(1500);
const opt = await page.evaluate(`(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((n) => n.offsetParent !== null);
  if (!items.length) return 'no-option';
  items[0].click();
  return 'ok:' + (items[0].textContent || '').trim();
})()`);
console.log('WH_OPT ' + opt);
await page.waitForTimeout(1000);
await restore();
console.log('QTY2 ' + await page.evaluate(setQtyExpr(2)));
await page.waitForTimeout(700);
console.log('ADD2 ' + await page.evaluate(addExpr));
await page.waitForTimeout(1800);
console.log('LIST2 ' + JSON.stringify(await page.evaluate(readExpr), null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-19-ret-list.png" });

console.log('SUBMIT ' + await page.evaluate(submitExpr));
await page.waitForTimeout(8000);
await restore();
console.log('AFTER ' + JSON.stringify(await page.evaluate(`(() => ({
  alerts: [...document.querySelectorAll('.el-alert__title, .el-message__content, .el-message')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  lineCount: document.querySelectorAll('.mo-line').length,
  body: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 420),
}))()`), null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-19-after-submit.png" });
console.log('DONE');
