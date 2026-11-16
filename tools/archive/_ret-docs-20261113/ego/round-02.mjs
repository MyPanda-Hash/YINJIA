// round-02:生产退料单面板 + 菜单挂点(库存核算下的两张新单)
const task = await taskSpace('return-docs-20261113');
const page = task.page('p1');

await page.goto('http://127.0.0.1:8091/#/panelx/list/MATERIAL_RET', { timeout: 30000 });
await page.waitForTimeout(3500);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }

const info = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const headerLabels = [...document.querySelectorAll('.el-form-item__label, .form-label, label')].map(txt).filter(Boolean);
  const buttons = [...document.querySelectorAll('button')].map(txt).filter(Boolean);
  const detailHeads = [...document.querySelectorAll('.el-table__header th')].map(txt).filter(Boolean);
  const tabs = [...document.querySelectorAll('.el-tabs__item')].map(txt);
  return { hash: location.hash, headerLabels: [...new Set(headerLabels)].slice(0, 60), buttons, tabs, detailHeads };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-docs-20261113/material-ret.png' });

// 菜单树:库存核算 → 单据 下应有 销售退货单 / 生产退料单
const menu = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  return [...document.querySelectorAll('.el-menu-item, .el-sub-menu__title, .el-tree-node__label, li')]
    .map(txt).filter((t) => t === '销售退货单' || t === '生产退料单' || t === '销售退货单明细表' || t === '生产退料单统计表');
});
console.log('菜单命中:', JSON.stringify(menu));
