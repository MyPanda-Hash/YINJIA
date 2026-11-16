const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) {}
};

// ① 列表页:行内不再有按钮,行可点
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK", { timeout: 40000 });
await page.waitForTimeout(9000);
await restore();
const list = await page.evaluate(`(() => ({
  hint: (document.querySelector('.mo-hist-hint')?.textContent || '').trim(),
  placeholder: document.querySelector('.mo-hist input')?.placeholder || '',
  docs: [...document.querySelectorAll('.mo-doc')].map((d) => ({
    no: (d.querySelector('.mo-doc-no')?.textContent || '').trim(),
    hasButton: !!d.querySelector('button'),
    cursor: getComputedStyle(d).cursor,
  })),
}))()`);
console.log('LIST ' + JSON.stringify(list, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-32-list-clickable.png" });

// ② 点第二张 → 进明细页
await page.evaluate(`(() => {
  const docs = [...document.querySelectorAll('.mo-doc')];
  const target = docs.find((d) => (d.querySelector('.mo-doc-no')?.textContent || '').includes('0005')) || docs[0];
  target && target.click();
  return 'ok';
})()`);
await page.waitForTimeout(5000);
await restore();
const doc = await page.evaluate(`(() => ({
  hash: location.hash,
  title: (document.querySelector('.mod-title')?.textContent || '').trim(),
  kvs: [...document.querySelectorAll('.mod-kv')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  lines: [...document.querySelectorAll('.mod-line')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  buttons: [...document.querySelectorAll('.mod button')].map((b) => (b.textContent || '').trim()),
}))()`);
console.log('DOC ' + JSON.stringify(doc, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-32-detail.png" });

// ③ 返回按钮回列表
await page.evaluate(`(() => {
  const b = [...document.querySelectorAll('.mod button')].find((x) => (x.textContent || '').includes('返回'));
  b && b.click();
  return 'ok';
})()`);
await page.waitForTimeout(3500);
const back = await page.evaluate(`(() => ({ hash: location.hash, hasHist: !!document.querySelector('.mo-hist') }))()`);
console.log('BACK ' + JSON.stringify(back));

// ④ 其他退料同样一条链
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET", { timeout: 40000 });
await page.waitForTimeout(8000);
await restore();
await page.evaluate(`(() => {
  const d = [...document.querySelectorAll('.mo-doc')][0];
  d && d.click();
  return 'ok';
})()`);
await page.waitForTimeout(5000);
await restore();
const retDoc = await page.evaluate(`(() => ({
  hash: location.hash,
  title: (document.querySelector('.mod-title')?.textContent || '').trim(),
  kvs: [...document.querySelectorAll('.mod-kv')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
  lines: [...document.querySelectorAll('.mod-line')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
}))()`);
console.log('RET_DOC ' + JSON.stringify(retDoc, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-32-detail-ret.png" });
console.log('DONE');
