const task = await taskSpace("copydoc-20261123");
const page = task.page("p1");
await page.goto("http://127.0.0.1:5173/#/panelx/list/RD_SAMPLE_EXT?docNo=SPW-2026-11-0008");
await page.waitForSelector(".as-side-btn", { timeout: 20000 });
await page.waitForTimeout(2500);
const cur = await page.evaluate(() => {
  const t = document.querySelector('.as-side-title');
  const pager = document.querySelector('.as-side-pager')?.textContent?.trim();
  const status = document.querySelector('.as-side-status-row')?.textContent?.trim();
  return { title: t?.textContent?.trim(), pager, status };
});
console.log(JSON.stringify(cur));
