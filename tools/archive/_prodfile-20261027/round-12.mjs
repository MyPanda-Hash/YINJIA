const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });
await page.evaluate(() => { location.hash = "#/panelx/list/RD_MOLD_PROC"; });
await page.waitForSelector(".rsp-pages", { state: "visible", timeout: 30000 });

// 打开列表里第一张单(测试账套刚建的那张),再切到配方页
const opened = await page.evaluate(() => {
  // 先看是不是要双击行
  const rows = [...document.querySelectorAll(".el-table__row, tr.rs-row, tbody tr")];
  if (rows.length) { rows[0].click(); return { clicked: true, rows: rows.length }; }
  return { clicked: false, rows: 0 };
});
console.log("OPEN=" + JSON.stringify(opened));
await page.waitForTimeout(2500);

const tabs = await page.evaluate(() => {
  const t = [...document.querySelectorAll(".rsp-pages > *")];
  if (!t.length) return [];
  const hit = t.find((e) => (e.textContent || "").trim() === "成型配方");
  if (hit) hit.click();
  return t.map((e) => (e.textContent || "").trim());
});
console.log("TABS=" + JSON.stringify(tabs));
await page.waitForTimeout(1500);

// 精确数:配方表那张 table 里,「带 ＋ / × 操作格」的行才是数据行
const detail = await page.evaluate(() => {
  const tables = [...document.querySelectorAll("table")];
  const info = [];
  for (const t of tables) {
    const txt = (t.textContent || "").replace(/\s+/g, "");
    if (!txt.includes("物料种类")) continue;
    const trs = [...t.querySelectorAll("tr")];
    const rows = trs.map((tr) => ({
      tds: tr.querySelectorAll("td").length,
      ths: tr.querySelectorAll("th").length,
      hasOp: !!tr.querySelector(".rs-op-del, .rs-op-add"),
      seq: (tr.querySelector("td")?.textContent || "").trim().slice(0, 6),
    }));
    info.push({ trs: trs.length, rows: rows.slice(0, 15) });
  }
  return { tableCount: tables.length, info };
});
console.log("DETAIL=" + JSON.stringify(detail, null, 1).slice(0, 3000));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-08.json", JSON.stringify({ opened, tabs, detail }, null, 2), "utf8");
await task.finish({ keep: [] });
