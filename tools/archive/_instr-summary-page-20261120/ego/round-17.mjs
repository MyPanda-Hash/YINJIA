// 第 17 轮(第二轮需求):按送样人也能勾选 —— 勾送样人=其全部单;展开子表可逐张勾/取消;两页签勾选同步
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(2000);
await page.reload();
await page.waitForTimeout(4500);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}

const read = () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const senderPane = document.getElementById('pane-sender');
  const docPane = document.getElementById('pane-doc');
  return {
    picked: t(document.querySelector('.iss-picked')),
    exportBtn: t(document.querySelector('.iss-export')),
    senderHeaders: senderPane ? [...senderPane.querySelectorAll('.el-table__header th')].map(t).filter(Boolean) : [],
    senderRows: senderPane ? [...senderPane.querySelectorAll('.el-table__body > tbody > tr.el-table__row')].map((tr) => [...tr.querySelectorAll('td')].map(t).filter(Boolean).join(' | ')) : [],
    senderChecked: senderPane ? senderPane.querySelectorAll('.el-table__body > tbody > tr.el-table__row .el-checkbox.is-checked').length : 0,
    subRows: senderPane ? [...senderPane.querySelectorAll('.iss-subtable .el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map(t).join(' | ')) : [],
    subChecked: senderPane ? senderPane.querySelectorAll('.iss-subtable .el-checkbox.is-checked').length : 0,
    docChecked: docPane ? docPane.querySelectorAll('.el-table__body > tbody > tr.el-table__row .el-checkbox.is-checked').length : 0,
  };
});
console.log('初始:', JSON.stringify(await read(), null, 2));

// ① 勾「系统管理员」(2 张单的那个送样人)
await page.click('loc=css:#pane-sender .el-table__body > tbody > tr.el-table__row:nth-child(1) .el-checkbox', { label: '勾选送样人' });
await page.waitForTimeout(900);
console.log('勾送样人后:', JSON.stringify(await read()));

// ② 展开该送样人,看子表是否回显勾选
await page.click('loc=css:#pane-sender .el-table__body > tbody > tr.el-table__row:nth-child(1) .el-table__expand-icon', { label: '展开该送样人' });
await page.waitForTimeout(1200);
console.log('展开后:', JSON.stringify(await read(), null, 2));

// ③ 取消子表第一张 → 应变成只勾 1 张,送样人行取消勾
await page.click('loc=css:#pane-sender .iss-subtable .el-table__row:nth-of-type(1) .el-checkbox', { label: '取消子表第一张' });
await page.waitForTimeout(900);
const afterSub = await read();
console.log('子表取消一张后:', JSON.stringify(afterSub));

// ④ 切到「按委托单」页签:勾选应同步为 1 张
await page.click('loc=css:#tab-doc', { label: '切到按委托单页签' });
await page.waitForTimeout(1000);
const afterTab = await read();
console.log('切到按委托单页签:', JSON.stringify({ picked: afterTab.picked, exportBtn: afterTab.exportBtn, docChecked: afterTab.docChecked }));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-17-sender-pick.png' });
console.log({ screenshot: shot });
