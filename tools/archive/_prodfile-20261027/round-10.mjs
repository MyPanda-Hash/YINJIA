const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });
await page.evaluate(() => { location.hash = "#/panelx/list/RD_MOLD_PROC"; });
await page.waitForSelector(".rsp-pages", { state: "visible", timeout: 30000 });

// 切到第 2 页(成型配方),看配方表的行数
const tabs = await page.evaluate(() => [...document.querySelectorAll(".rsp-pages > *")].map((e) => (e.textContent || "").trim()));
console.log("TABS=" + JSON.stringify(tabs));

// 点「成型配方」页签
await page.evaluate(() => {
  const els = [...document.querySelectorAll(".rsp-pages > *")];
  const hit = els.find((e) => (e.textContent || "").trim() === "成型配方");
  if (hit) hit.click();
});
await page.waitForTimeout(800);

const after = await page.evaluate(() => {
  // 找配方表那张表(按表头 No./物料种类 定位),数数据行
  const tables = [...document.querySelectorAll("table")];
  let found = null;
  for (const t of tables) {
    const head = (t.querySelector("tr")?.textContent || "").replace(/\s+/g, "");
    if (head.includes("物料种类") && head.includes("物料编号")) { found = t; break; }
  }
  if (!found) return { ok: false, note: "没找到配方表", tableCount: tables.length };
  const rows = [...found.querySelectorAll("tbody tr")];
  return {
    ok: true,
    head: (found.querySelector("tr")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
    rowCount: rows.length,
    firstRows: rows.slice(0, 4).map((tr) => [...tr.querySelectorAll("td")].map((td) => (td.textContent || "").trim())),
  };
});
console.log("RECIPE=" + JSON.stringify(after, null, 1));

// 页面上是否有「产品管控等级」「产品形态」两个表头(第1页)
await page.click?.("body").catch(() => {});
const p1 = await page.evaluate(() => {
  const els = [...document.querySelectorAll(".rsp-pages > *")];
  const hit = els.find((e) => (e.textContent || "").trim() === "成型工艺清单");
  if (hit) hit.click();
  return true;
});
await page.waitForTimeout(600);
const heads = await page.evaluate(() => {
  const t = document.body.innerText || "";
  return {
    hasCtrlLevel: t.includes("产品管控等级"),
    hasCtrlType: t.includes("产品管控类型"),
    hasForm: t.includes("产品形态"),
    hasOldForm: t.includes("外观要求"),
  };
});
console.log("HEADERS=" + JSON.stringify(heads));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-06.json", JSON.stringify({ tabs, after, heads }, null, 2), "utf8");
await task.finish({ keep: [] });
