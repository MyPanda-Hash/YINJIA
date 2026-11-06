const task = await taskSpace("加标水模版设计器验证-20261106");
const page = task.page("p1");
const opt = await page.evaluate(() => {
  const n = [...document.querySelectorAll(".el-select-dropdown__item")].find((x) => (x.innerText || "").includes("ZZ-测试模版"));
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
console.log("opt", JSON.stringify(opt));
if (opt) { await page.mouse.click(opt.x, opt.y, { label: "select new template" }); }
await page.waitForTimeout(1600);
const st = await page.evaluate(() => {
  const sheet = document.querySelector(".record-sheet") || document.body;
  const ths = [...sheet.querySelectorAll("th")].map((n) => (n.innerText || "").trim().replace(/\n/g, "↵")).filter(Boolean);
  const pick = [...document.querySelectorAll(".rsp-sub-ctl input")].map((i) => i.value);
  return { heads: ths, subValues: pick, messages: [...document.querySelectorAll(".el-message")].map((n) => n.innerText.trim()).slice(0, 2) };
});
console.log(JSON.stringify(st, null, 1));
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-tpl-20261106/header-switched.png" });
