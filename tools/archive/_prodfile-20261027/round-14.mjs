const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

// 先切回测试账套
const lg = await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: "admin", password: "123456", factory: "YJ_TEST" }),
  });
  const j = await r.json();
  return j?.data?.token || "";
});
await page.evaluate((t) => {
  localStorage.setItem("mes_token", t); localStorage.setItem("token", t);
  localStorage.setItem("mes_factory", "YJ_TEST"); sessionStorage.removeItem("mes_at_login");
}, lg);

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

const r = await page.evaluate(async () => {
  const tk = localStorage.getItem("mes_token") || "";
  const h = { Authorization: "Bearer " + tk, "Content-Type": "application/json" };
  const post = async (u, b) => { const x = await fetch(u, { method: "POST", headers: h, body: JSON.stringify(b) }); return await x.json(); };

  const q = await post("/api/px/queryFormDataList", { panelCode: "RD_PROD_INFO", condition: {}, pageNo: 1, pageSize: 5 });
  const codes = (q?.data?.list || []).map((x) => x["产品编号"]).filter(Boolean);

  const m = await post("/api/px/queryFormDataList", { panelCode: "RD_MOLD_PROC", condition: {}, pageNo: 1, pageSize: 10 });
  const mlist = (m?.data?.list || []).map((x) => ({
    docNo: x["单据编号"], code: x["产品编号"],
    ctrl: x["产品管控等级"] ?? x["产品管控类型"] ?? null,
    form: x["外观要求"] ?? null,
    stdlib: x["产品形态"] ?? null,
  }));
  return { prodCodes: codes, moldCodes: mlist, prodTotal: q?.data?.total, moldTotal: m?.data?.total };
});
console.log("PROD_CODES=" + JSON.stringify(r.prodCodes));
console.log("TOTALS prod=" + r.prodTotal + " mold=" + r.moldTotal);
console.log("MOLD=" + JSON.stringify(r.moldCodes.slice(0, 4), null, 1));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-10.json", JSON.stringify(r, null, 2), "utf8");
await task.finish({ keep: [] });
