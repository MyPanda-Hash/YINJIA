const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(2500);
await page.click('loc=css:.nav-group:has-text("研发管理")', { label: '打开研发管理' });
await page.waitForTimeout(1200);
const snap = await page.evaluate(() => {
  const t = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const box = document.querySelector('.nav-modules') || document.querySelector('.nav-module')?.parentElement;
  return {
    modules: [...document.querySelectorAll('.nav-module')].map(t),
    html: box ? box.outerHTML.slice(0, 1800) : null,
  };
});
console.log(JSON.stringify(snap, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-12-nav.png' });
console.log({ screenshot: shot });
