const task = await taskSpace("copydoc-20261123");
const page = task.page("p1");
const out = {};
for (const [code, label] of [["RD_APPROVAL","立项"],["RD_PLAN","实施计划"],["RD_PROD_INFO","产品信息表"],["RD_SAMPLE_ND","外部非开发"]]) {
  await page.goto(`http://127.0.0.1:5173/#/panelx/list/${code}`);
  await page.waitForSelector(".as-side-btn", { timeout: 20000 });
  await page.waitForTimeout(2000);
  const btns = await page.evaluate(() => [...document.querySelectorAll('.as-side-btn')].map((n) => n.textContent.trim()));
  out[code] = { label, 复制单据: btns.includes('复制单据'), 新增: btns.includes('新增'), idxCopy: btns.indexOf('复制单据'), idxAdd: btns.indexOf('新增') };
}
console.log(JSON.stringify(out, null, 1));
