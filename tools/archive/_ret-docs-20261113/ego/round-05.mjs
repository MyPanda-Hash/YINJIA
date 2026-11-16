// round-05:生产退料单表头/明细里的「工单号 / 工单行号」取证(登录测试库看刚退出来的单)
const task = await taskSpace('return-docs-20261113');
const page = task.page('p1');

await page.goto('http://127.0.0.1:8090/#/panelx/list/MATERIAL_RET', { timeout: 30000 });
await page.waitForTimeout(4000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(500);
} catch (e) { console.log('restore skip: ' + e.message); }

const info = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => txt(th).replace('⇅', '')).filter(Boolean);
  // 表头表单:标签 → 输入值
  const form = [...document.querySelectorAll('.el-form-item')].map((it) => {
    const label = txt(it.querySelector('.el-form-item__label') || {});
    const val = it.querySelector('input,textarea') ? (it.querySelector('input,textarea').value || '') : '';
    return label ? `${label}=${val}` : '';
  }).filter(Boolean);
  return { hash: location.hash, heads, form };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-docs-20261113/material-ret-wo.png' });
