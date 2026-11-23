const task = await taskSpace("copydoc-20261123");
const page = task.page("p1");
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.as-side-btn')];
  const b = btns.find((n) => n.textContent.trim() === '复制单据');
  if (!b) return { ok: false, btns: btns.map((n) => n.textContent.trim()) };
  b.click();
  return { ok: true };
});
console.log("click", JSON.stringify(clicked));
// 等 toast + 定位完成
await page.waitForTimeout(3500);
const after = await page.evaluate(() => {
  const msgs = [...document.querySelectorAll('.el-message')].map((n) => n.textContent.trim());
  const pager = document.querySelector('.as-side-pager')?.textContent?.trim();
  const status = document.querySelector('.as-side-status-row')?.textContent?.trim();
  const no = document.querySelector('.as-side-pager')?.textContent?.trim();
  // 单据号纸面
  const docNoCells = [...document.querySelectorAll('.rsp-docno, .doc-no, [class*="docno"]')].map((n) => n.textContent.trim()).slice(0, 6);
  return { msgs, pager, status, docNoCells };
});
console.log(JSON.stringify(after, null, 1));
