const task = await taskSpace('po-3numbers-20261126');
const page = task.page('p1');
await page.goto('http://36.140.66.163:8090/#/panelx/list/PU_ORDER?docNo=YJ-20260921-10', { timeout: 60000 });
await page.waitForTimeout(7000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(500);
} catch (e) { console.log('restore skip: ' + e.message); }

const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  // 表头/单据信息：取所有 label:value 形态的文本
  const tables = [...document.querySelectorAll('table')].map((t) => ({
    cls: t.className,
    head: [...t.querySelectorAll('thead th')].map((th) => txt(th)),
    rows: [...t.querySelectorAll('tbody tr')].slice(0, 30).map((tr) => [...tr.querySelectorAll('td')].map((td) => txt(td))),
  }));
  const inputs = [...document.querySelectorAll('input')].filter((i) => i.value && i.offsetParent).slice(0, 60)
    .map((i) => `${i.placeholder || i.name || i.className}:${i.value}`);
  return { hash: location.hash, tables, inputs, headText: txt(document.querySelector('.page, .panelx, body')).slice(0, 700) };
});
console.log(JSON.stringify(info, null, 2).slice(0, 12000));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-3numbers-20261126/r03-po-detail.png' });
