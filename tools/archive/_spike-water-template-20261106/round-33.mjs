const task = await taskSpace("加标水模版设计器验证-20261106");
const page = task.page("p1");
await page.click('.el-dialog button:has-text("新增模版")', { label: "new template" });
await page.waitForTimeout(800);
const box = await page.evaluate(() => {
  const b = [...document.querySelectorAll(".el-message-box")].filter((x) => getComputedStyle(x).display !== "none")[0];
  if (!b) return { none: true };
  return {
    title: (b.querySelector(".el-message-box__title") || {}).innerText || "",
    msg: (b.querySelector(".el-message-box__message") || {}).innerText || "",
    input: !!b.querySelector("input"),
    placeholders: [...b.querySelectorAll("input")].map((i) => i.placeholder),
    btns: [...b.querySelectorAll("button")].map((x) => (x.innerText || "").trim()).filter(Boolean),
  };
});
console.log(JSON.stringify(box, null, 1));
await page.fill('.el-message-box input', "ZZ-测试模版-20261106");
await page.click('.el-message-box button:has-text("创建并设计")', { label: "create and design" });
await page.waitForTimeout(1500);
const ed = await page.evaluate(() => {
  const dlgs = [...document.querySelectorAll(".el-dialog")].filter((x) => getComputedStyle(x).display !== "none");
  const dlg = dlgs[dlgs.length - 1];
  if (!dlg) return { none: true };
  return {
    title: (dlg.querySelector(".el-dialog__title") || {}).innerText || "",
    text: (dlg.innerText || "").replace(/\n+/g, " | ").slice(0, 1000),
    rows: [...dlg.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((td) => (td.innerText || "").trim()).join(" | ")),
    btns: [...dlg.querySelectorAll("button")].map((b) => (b.innerText || "").trim()).filter(Boolean),
  };
});
console.log(JSON.stringify(ed, null, 1));
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-tpl-20261106/editor-new.png" });
