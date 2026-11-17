const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
const restore = async () => {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
    await page.waitForTimeout(400);
  } catch (e) {}
};

// ① 其他领料:历史单据应列出 OO-2026-11-0005 / 0006
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK", { timeout: 40000 });
await page.waitForTimeout(8000);
await restore();
const st1 = await page.evaluate(`(() => ({
  groups: [...document.querySelectorAll('.mo-grp')].map((g) => ({
    title: (g.querySelector('.mo-grp-title')?.textContent || '').trim(),
    n: (g.querySelector('.mo-grp-num')?.textContent || '').trim(),
  })),
  docs: [...document.querySelectorAll('.mo-doc')].map((d) => ({
    no: (d.querySelector('.mo-doc-no')?.textContent || '').trim(),
    state: (d.querySelector('.mo-doc-state')?.textContent || '').trim(),
    l2: (d.querySelector('.mo-doc-l2')?.textContent || '').replace(/\\s+/g, ' ').trim(),
    hit: d.classList.contains('hit'),
  })),
  body: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 380),
}))()`);
console.log('PICK_HIST ' + JSON.stringify(st1, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-29-pick-history.png", fullPage: true });

// ② 扫码 = 查询:把单据二维码内容输进查询框,应定位并高亮 OO-2026-11-0006
await page.evaluate(`(() => {
  const el = document.querySelector('.mo-hist input');
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(el, 'YJSLIP:OTHER_PICK:OO-2026-11-0006');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`);
await page.waitForTimeout(400);
await page.evaluate(`(() => {
  const b = [...document.querySelectorAll('.mo-hist-row button')].find((x) => (x.textContent || '').trim() === '查询');
  b && b.click();
  return 'ok';
})()`);
await page.waitForTimeout(3500);
await restore();
const st2 = await page.evaluate(`(() => ({
  keyword: document.querySelector('.mo-hist input')?.value || '',
  docs: [...document.querySelectorAll('.mo-doc')].map((d) => ({
    no: (d.querySelector('.mo-doc-no')?.textContent || '').trim(),
    hit: d.classList.contains('hit'),
  })),
  alerts: [...document.querySelectorAll('.el-alert__title')].map((n) => (n.textContent || '').trim()),
}))()`);
console.log('SCAN_AS_QUERY ' + JSON.stringify(st2, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-29-scan-query.png", fullPage: true });

// ③ 查看明细
await page.evaluate(`(() => {
  const b = [...document.querySelectorAll('.mo-doc button')].find((x) => (x.textContent || '').includes('查看明细'));
  b && b.click();
  return 'ok';
})()`);
await page.waitForTimeout(2500);
const st3 = await page.evaluate(`(() => ({
  lines: [...document.querySelectorAll('.mo-doc-line')].map((n) => (n.textContent || '').replace(/\\s+/g, ' ').trim()),
}))()`);
console.log('DETAIL ' + JSON.stringify(st3, null, 2));

// ④ 其他退料页的历史
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_OTHER_RET", { timeout: 40000 });
await page.waitForTimeout(8000);
await restore();
const st4 = await page.evaluate(`(() => ({
  docs: [...document.querySelectorAll('.mo-doc')].map((d) => (d.querySelector('.mo-doc-no')?.textContent || '').trim()),
}))()`);
console.log('RET_HIST ' + JSON.stringify(st4, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-29-ret-history.png", fullPage: true });
console.log('DONE');
