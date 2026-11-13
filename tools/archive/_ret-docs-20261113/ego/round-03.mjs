// round-03:鏈€缁堝彇璇?鏂伴潰鏉?鏄庣粏/姹囨€?姝ｅ父娓叉煋 + 鑿滃崟鎸傜偣)
const task = await taskSpace('return-docs-20261113');
const page = task.page('p1');

const go = async (url, file) => {
  await page.goto(url, { timeout: 30000 });
  await page.waitForTimeout(3500);
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {});
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
    await page.waitForTimeout(500);
  } catch (e) { console.log('restore skip: ' + e.message); }
  const info = await page.evaluate(() => {
    const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const tabs = [...document.querySelectorAll('.el-tabs__item')].map(txt);
    const activeCols = [...document.querySelectorAll('.el-table__header th')].map(txt).filter(Boolean);
    const err = [...document.querySelectorAll('.el-message, .el-alert, .el-notification')].map(txt).filter(Boolean);
    const rows = [...document.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map(txt).filter(Boolean).slice(0, 5));
    return { hash: location.hash, tabs, cols: activeCols, err, rows: rows.slice(0, 5) };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: `C:/Users/Lenovo/ego/return-docs-20261113/${file}` });
};

await go('http://127.0.0.1:8091/#/panelx/list/SALE_IN', 'sale-in-final.png');
await go('http://127.0.0.1:8091/#/panelx/list/MATERIAL_RET', 'material-ret-final.png');

