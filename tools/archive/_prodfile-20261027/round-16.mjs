const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

// 历史兼容:两种形态(带 -tb / 不带)都要能被下游端点接受,不报错
const out = await page.evaluate(async () => {
  const tk = localStorage.getItem("mes_token") || "";
  const h = { Authorization: "Bearer " + tk, "Content-Type": "application/json" };
  const get = async (u) => { const x = await fetch(u, { headers: h }); const j = await x.json().catch(() => null); return { status: x.status, code: j?.code, msg: j?.message }; };

  const res = {};
  for (const code of ["wqedqw", "wqedqw-tb"]) {
    res[code] = {};
    res[code].specByProductForMold = await get("/api/px/specByProductForMold?code=" + encodeURIComponent(code));
  }
  return res;
});
console.log("DOWNSTREAM=" + JSON.stringify(out, null, 1));

// 打开历史单(不带后缀)看是否正常渲染、不报 red error
await page.evaluate(() => { location.hash = "#/panelx/list/RD_MOLD_PROC"; });
await page.waitForSelector(".rsp-pages", { state: "visible", timeout: 30000 });
await page.waitForTimeout(1500);
const fatal = await page.evaluate(() => {
  const b = document.getElementById("boot-fatal");
  return b ? b.textContent.slice(0, 200) : "";
});
console.log("FATAL=" + JSON.stringify(fatal));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-12.json", JSON.stringify({ out, fatal }, null, 2), "utf8");
await task.finish({ keep: [] });
