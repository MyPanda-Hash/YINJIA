const task = await taskSpace("copydoc-20261123");
const page = task.page("p1");
await page.goto("http://127.0.0.1:5173/#/panelx/list/RD_APPROVAL?docNo=LXA-2026-11-0031");
await page.waitForSelector(".as-side-btn", { timeout: 20000 });
await page.waitForTimeout(2500);
const before = await page.evaluate(() => ({
  status: document.querySelector('.as-side-status-row')?.textContent?.trim(),
  no: [...document.querySelectorAll('.sheet-scroll input')].map((e) => e.value).filter(Boolean).slice(0, 5),
}));
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((n) => n.textContent.trim() === '复制单据');
  if (!b) return false;
  b.click();
  return true;
});
await page.waitForTimeout(3500);
const after = await page.evaluate(() => ({
  msgs: [...document.querySelectorAll('.el-message')].map((n) => n.textContent.trim()),
  status: document.querySelector('.as-side-status-row')?.textContent?.trim(),
  no: [...document.querySelectorAll('.sheet-scroll input')].map((e) => e.value).filter(Boolean).slice(0, 5),
}));
console.log(JSON.stringify({ before, clicked, after }, null, 1));
