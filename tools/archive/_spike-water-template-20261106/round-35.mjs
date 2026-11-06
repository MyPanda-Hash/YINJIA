const task = await taskSpace("加标水模版设计器验证-20261106");
const page = task.page("p1");
await page.click('.el-dialog button:has-text("保存")', { label: "save template" });
await page.waitForTimeout(2200);
const st = await page.evaluate(() => {
  const dlgs = [...document.querySelectorAll(".el-dialog")].filter((x) => getComputedStyle(x).display !== "none");
  const manager = dlgs[dlgs.length - 1];
  return {
    openDialogs: dlgs.map((d) => (d.querySelector(".el-dialog__title") || {}).innerText || ""),
    messages: [...document.querySelectorAll(".el-message")].map((n) => (n.innerText || "").trim()).filter(Boolean).slice(0, 4),
    managerText: manager && (manager.innerText || "").replace(/\n+/g, " | ").slice(0, 700),
    rows: manager ? [...manager.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((td) => (td.innerText || "").trim()).join(" | ")) : [],
  };
});
console.log(JSON.stringify(st, null, 1));
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-tpl-20261106/after-save.png" });
