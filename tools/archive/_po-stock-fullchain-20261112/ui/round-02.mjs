// 界面取证(2026-11-12)round-02:关掉弹窗,把明细表横向滚到最右,截「现存量」列
const outDir = 'C:/Users/Lenovo/ego/qc-recv-stock-visible-20261112';
const task = await taskSpace('qc-recv-stock-visible-20261112');
const page = task.page('p1');

await page.goto('http://localhost:5173/#/panelx/list/QC_RECV', { timeout: 30000 });
await page.waitForTimeout(4000);
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(500);
} catch (e) { console.log('restore skip: ' + e.message); }

// 明细表横向滚到最右(现存量在最后一列)
const scrolled = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.el-table__body-wrapper, .ant-table-body, .vxe-table--body-wrapper, .el-scrollbar__wrap')];
  let moved = 0;
  for (const b of boxes) {
    if (b.scrollWidth > b.clientWidth + 20) { b.scrollLeft = b.scrollWidth; moved++; }
  }
  return { moved, total: boxes.length };
});
console.log('横向滚动:', JSON.stringify(scrolled));

const info = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('th')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const idx = heads.findIndex((h) => h.replace('⇅', '') === '现存量');
  const firstRow = document.querySelector('tbody tr');
  const cells = firstRow ? [...firstRow.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()) : [];
  return { heads, 现存量列序号: idx, 首行现存量值: idx >= 0 ? cells[idx] : null };
});
console.log(JSON.stringify(info).slice(0, 500));

await page.screenshot({ path: `${outDir}/round-02.png` });
console.log('截图:', `${outDir}/round-02.png`);
