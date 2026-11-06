const task = await taskSpace("加标水模版设计器验证-20261106");
const page = task.page("p1");
await page.click('.el-dialog button:has-text("加一列")', { label: "add column" });
await page.waitForTimeout(500);
const addBar = await page.evaluate(() => {
  const bar = document.querySelector(".slv-add");
  return bar ? { text: (bar.innerText || "").replace(/\n+/g, " | "), inputs: [...bar.querySelectorAll("input")].map((i) => i.placeholder || i.value) } : null;
});
console.log("addBar", JSON.stringify(addBar));
await page.fill('.slv-add input[placeholder*="列名"]', "探针试剂X");
await page.click('.slv-add button:has-text("加入")', { label: "add custom column" });
await page.waitForTimeout(600);
const rows = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll(".el-dialog")].filter((x) => getComputedStyle(x).display !== "none").pop();
  return {
    count: (dlg.querySelectorAll("tbody tr") || []).length,
    last: [...dlg.querySelectorAll("tbody tr")].slice(-2).map((tr) => [...tr.children].map((td) => (td.innerText || "").trim()).join(" | ")),
    counter: (dlg.querySelector(".slv-count") || {}).innerText,
  };
});
console.log(JSON.stringify(rows, null, 1));
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-tpl-20261106/editor-added.png" });
