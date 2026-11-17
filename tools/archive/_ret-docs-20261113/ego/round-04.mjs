// round-04:字段布局定稿后的界面取证(表头顺序 + 明细列顺序,登录测试库看有数据的单)
const task = await taskSpace('return-docs-20261113');
const page = task.page('p1');

const go = async (url, file) => {
  await page.goto(url, { timeout: 30000 });
  await page.waitForTimeout(4000);
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {});
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
    await page.waitForTimeout(500);
  } catch (e) { console.log('restore skip: ' + e.message); }
  const info = await page.evaluate(() => {
    const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
    const labels = [...document.querySelectorAll('.el-form-item__label')].map(txt).filter(Boolean);
    const tabs = [...document.querySelectorAll('.el-tabs__item')].map(txt);
    const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => txt(th).replace('⇅', '')).filter(Boolean);
    const err = [...document.querySelectorAll('.el-message--error, .el-alert, .el-notification')].map(txt).filter(Boolean);
    return { hash: location.hash, labels, tabs, heads, err };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: `C:/Users/Lenovo/ego/return-docs-20261113/${file}` });
};

await go('http://127.0.0.1:8090/#/panelx/list/SALE_IN', 'sale-in-layout.png');
await go('http://127.0.0.1:8090/#/panelx/list/MATERIAL_RET', 'material-ret-layout.png');
