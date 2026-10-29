const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

// 用应用内 router 跳转(直接改 hash 不会被 vue-router 当成一次导航的时机不一定)
await page.evaluate(() => { location.hash = "#/panelx/list/RD_MOLD_PROC"; });
await page.waitForSelector(".rsp-pages, .rsp-sheet, .approval-sheet, .px-list", { state: "visible", timeout: 30000 });

// 页签顺序
const tabs = await page.evaluate(() => [...document.querySelectorAll(".rsp-pages > *")]
  .map((e) => (e.textContent || "").trim()));

// 当前页正文(判断是不是成型工艺清单页)
const bodyText = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 600));

console.log("TABS=" + JSON.stringify(tabs));
console.log("BODY=" + bodyText);

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-02.json",
  JSON.stringify({ tabs, bodyText }, null, 2), "utf8");

await task.finish({ keep: [] });
