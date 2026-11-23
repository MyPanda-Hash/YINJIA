const task = await taskSpace("copydoc-20261123");
const page = task.page("p1");
await page.goto("http://127.0.0.1:5173/#/panelx/list/RD_SAMPLE_EXT");
await page.waitForSelector(".as-side-btn", { timeout: 20000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const secs = [...document.querySelectorAll('.as-side-section')].map((n) => n.textContent.trim());
  const btns = [...document.querySelectorAll('.as-side-btn')].map((n) => n.textContent.trim());
  return { secs, btns };
});
console.log(JSON.stringify(info, null, 1));
