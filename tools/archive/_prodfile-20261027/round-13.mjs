const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });
await page.evaluate(() => { location.hash = "#/panelx/list/RD_MOLD_PROC"; });
await page.waitForSelector(".rsp-pages", { state: "visible", timeout: 30000 });

// 第 1 页「产品基本信息」里的 炭棒编号(=产品编号)格:看是不是参照控件,以及当前值
const info = await page.evaluate(() => {
  const out = [];
  const tds = [...document.querySelectorAll("td")];
  for (const td of tds) {
    const t = (td.textContent || "").trim();
    if (t === "炭棒编号" || t === "产品管控等级" || t === "产品形态") {
      const next = td.nextElementSibling;
      out.push({
        label: t,
        nextHtml: next ? next.innerHTML.slice(0, 300) : "",
        refText: next?.querySelector(".rs-ref-text")?.textContent?.trim() || "",
        isRef: !!next?.querySelector(".rs-ref-ctl"),
        isSelect: !!next?.querySelector(".el-select"),
      });
    }
  }
  return out;
});
console.log("INFO=" + JSON.stringify(info, null, 1));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-09.json", JSON.stringify(info, null, 2), "utf8");
await task.finish({ keep: [] });
