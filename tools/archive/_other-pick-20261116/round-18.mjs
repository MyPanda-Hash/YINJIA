const task = await taskSpace("start-system-20261110");
const page = task.page("p1");

const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) { console.log("restore skip: " + e.message); }
};

// ⚠ 一律用「表达式字符串」形式的 page.evaluate:带参数的函数形式在本环境里会 Illegal invocation
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
  cand: document.querySelectorAll('.mo-cand').length,
  scanText: document.querySelector('.mo-scanbar input')?.value || '',
}))()`

await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK", { timeout: 40000 });
await page.waitForTimeout(7000);
await restore();

console.log('SCAN1 ' + await page.evaluate(scanExpr('HP-08')));
await page.waitForTimeout(4000);
console.log('CAND ' + JSON.stringify(await page.evaluate(readExpr)));
console.log('QTY ' + await page.evaluate(setQtyExpr(2)));
await page.waitForTimeout(800);
console.log('ADD1 ' + await page.evaluate(addExpr));
await page.waitForTimeout(2000);
console.log('LIST1 ' + JSON.stringify(await page.evaluate(readExpr), null, 2));

// 同物料同批次再扫 3 件 ⇒ 应累加在同一行(数量 5)
console.log('SCAN2 ' + await page.evaluate(scanExpr('HP-08')));
await page.waitForTimeout(4000);
console.log('QTY2 ' + await page.evaluate(setQtyExpr(3)));
await page.waitForTimeout(800);
console.log('ADD2 ' + await page.evaluate(addExpr));
await page.waitForTimeout(2000);
console.log('LIST2(应 1 行、数量 5) ' + JSON.stringify(await page.evaluate(readExpr), null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-18-pick-list.png" });

const submitExpr = `(() => {
  const b = [...document.querySelectorAll('.mo-foot button')].find((x) => (x.textContent || '').trim() === '提交');
  if (!b) return 'no-submit';
  b.click();
  return 'ok';
})()`
console.log('SUBMIT ' + await page.evaluate(submitExpr));
await page.waitForTimeout(8000);
await restore();
const after = await page.evaluate(`(() => ({
  alerts: [...document.querySelectorAll('.el-alert__title, .el-message__content, .el-message')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  lineCount: document.querySelectorAll('.mo-line').length,
  scanText: document.querySelector('.mo-scanbar input')?.value || '',
  body: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 420),
}))()`);
console.log('AFTER ' + JSON.stringify(after, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-18-after-submit.png" });
console.log('DONE');
