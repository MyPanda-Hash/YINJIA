const task = await taskSpace("加标水模版设计器验证-20261106");
const page = task.page("p1");
const rect = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll(".el-dialog")].find((d) => ((d.querySelector(".el-dialog__title") || {}).innerText || "").includes("编辑表格模版"));
  if (!dlg) return null;
  const row = dlg.querySelectorAll("tbody tr")[6];
  const inp = row.querySelectorAll("td")[1].querySelector("input");
  const r = inp.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), before: inp.value };
});
console.log("cell", JSON.stringify(rect));
await page.mouse.click(rect.x, rect.y, { label: "focus column name" });
await page.keyboard.press("ControlOrMeta+a");
await page.keyboard.type("探针试剂X-改");
await page.waitForTimeout(300);
const saveBtn = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll(".el-dialog")].find((d) => ((d.querySelector(".el-dialog__title") || {}).innerText || "").includes("编辑表格模版"));
  const b = [...dlg.querySelectorAll(".el-dialog__footer button")].find((x) => (x.innerText || "").trim() === "保存");
  const r = b.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
await page.mouse.click(saveBtn.x, saveBtn.y, { label: "save edited template" });
await page.waitForTimeout(2200);
const after = await page.evaluate(async () => {
  const r = await fetch("/api/stdlib/list?lib=lab.test_item&all=1", { headers: { Authorization: "Bearer " + localStorage.getItem("mes_token") } });
  const b = await r.json();
  const hit = (b.data || []).find((x) => x.item === "ZZ-测试模版-20261106");
  let cols = [];
  try { cols = JSON.parse(hit.content).cols; } catch (e) {}
  return { msg: [...document.querySelectorAll(".el-message")].map((n) => n.innerText.trim()).slice(0, 2), last: cols[cols.length - 1], width1: cols[0] && cols[0].w };
});
console.log(JSON.stringify(after, null, 1));
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-tpl-20261106/after-edit-save.png" });
