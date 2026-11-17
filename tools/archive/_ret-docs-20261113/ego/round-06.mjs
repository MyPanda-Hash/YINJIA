// round-06:硬刷新后再取证「工单号 / 工单行号」是否出现在表头与明细
const task = await taskSpace('return-docs-20261113');
const page = task.page('p1');

await page.goto('http://127.0.0.1:8090/#/panelx/list/MATERIAL_RET?t=' + Date.now(), { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(() => location.reload());
await page.waitForTimeout(5000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(600);
} catch (e) { console.log('restore skip: ' + e.message); }

const info = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => txt(th).replace('⇅', '')).filter(Boolean);
  // 表头区:抓所有可见的字段标签(表单 label 结构各版不同,这里抓纯文本节点更稳)
  const bodyText = document.body.innerText;
  const hasLabel = (s) => bodyText.includes(s);
  return {
    hash: location.hash,
    heads,
    has工单号: hasLabel('工单号'),
    has加工单号: hasLabel('加工单号'),
    has工单行号: hasLabel('工单行号'),
    docNo: (bodyText.match(/TL-\d{4}-\d{2}-\d{4}/) || [])[0] || '',
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-docs-20261113/material-ret-wo2.png' });
