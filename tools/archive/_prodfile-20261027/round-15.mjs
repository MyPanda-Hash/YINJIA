const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

const out = await page.evaluate(async () => {
  const tk = localStorage.getItem("mes_token") || "";
  const h = { Authorization: "Bearer " + tk, "Content-Type": "application/json" };
  const post = async (u, b) => { const x = await fetch(u, { method: "POST", headers: h, body: JSON.stringify(b) }); return await x.json(); };

  const withSuffix = "wqedqw-tb";
  const save = await post("/api/px/callButton", {
    panelCode: "RD_MOLD_PROC",
    buttonName: "保存为草稿",
    formData: { 产品编号: withSuffix, 产品名称: "后缀验证", 单据日期: "2026-10-27" },
    detail: { items: [{ 表区: "配方表", 序号: "1" }] },
  });
  const d = save?.data || {};
  const docNo = d.docNo || d["单据编号"] || d.no || "";
  return { saveCode: save?.code, saveMsg: save?.message, dataKeys: Object.keys(d), docNo, withSuffix };
});
console.log("SAVE=" + JSON.stringify(out));

if (out.docNo) {
  const back = await page.evaluate(async (docNo) => {
    const tk = localStorage.getItem("mes_token") || "";
    const h = { Authorization: "Bearer " + tk, "Content-Type": "application/json" };
    const r = await fetch("/api/px/queryFormDataList", {
      method: "POST", headers: h,
      body: JSON.stringify({ panelCode: "RD_MOLD_PROC", condition: { 单据编号: docNo }, pageNo: 1, pageSize: 5 }),
    });
    const j = await r.json();
    const row = (j?.data?.list || [])[0] || null;
    return row ? { 单据编号: row["单据编号"], 产品编号: row["产品编号"], 产品名称: row["产品名称"] } : null;
  }, out.docNo);
  console.log("BACK=" + JSON.stringify(back));
}

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-11.json", JSON.stringify(out, null, 2), "utf8");
await task.finish({ keep: [] });
