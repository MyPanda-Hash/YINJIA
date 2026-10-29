const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

// 用**测试账套** YJ_TEST 登录(不在正式库造测试单据)
const tok = await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: "admin", password: "123456", factory: "YJ_TEST" }),
  });
  const j = await r.json();
  return { code: j?.code, token: j?.data?.token || "", user: j?.data?.user?.userName || "" };
});
console.log("LOGIN=" + JSON.stringify({ code: tok.code, tokenLen: tok.token.length, user: tok.user }));

await page.evaluate((t) => {
  localStorage.setItem("mes_token", t);
  localStorage.setItem("token", t);
  localStorage.setItem("mes_factory", "YJ_TEST");
  sessionStorage.removeItem("mes_at_login");
}, tok.token);

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });
await page.evaluate(() => { location.hash = "#/panelx/list/RD_MOLD_PROC"; });
await page.waitForSelector(".rsp-pages", { state: "visible", timeout: 30000 });

// 点「新增」建一张草稿单
const added = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, .el-button, .as-side-btn")];
  const hit = btns.find((b) => (b.textContent || "").trim() === "新增");
  if (!hit) return { ok: false, texts: btns.map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 25) };
  hit.click();
  return { ok: true };
});
console.log("ADD=" + JSON.stringify(added));
await page.waitForTimeout(3500);

// 建单后:切到「成型配方」页签,数配方表行数
const r = await page.evaluate(async () => {
  const tabs = [...document.querySelectorAll(".rsp-pages > *")];
  const hit = tabs.find((e) => (e.textContent || "").trim() === "成型配方");
  if (hit) hit.click();
  return { tabs: tabs.map((e) => (e.textContent || "").trim()) };
});
console.log("TABS2=" + JSON.stringify(r.tabs));
await page.waitForTimeout(1200);

const recipe = await page.evaluate(() => {
  const tables = [...document.querySelectorAll("table")];
  let found = null;
  for (const t of tables) {
    const head = (t.textContent || "").replace(/\s+/g, "");
    if (head.includes("物料种类") && head.includes("物料编号") && head.includes("实际添加比例")) { found = t; break; }
  }
  if (!found) {
    // 退一步:任何含「No.」+「物料」的表
    for (const t of tables) {
      const head = (t.textContent || "").replace(/\s+/g, "");
      if (head.includes("No.") && head.includes("物料")) { found = t; break; }
    }
  }
  if (!found) return { ok: false, tableCount: tables.length, visibleText: (document.body.innerText || "").slice(0, 300) };
  const trs = [...found.querySelectorAll("tr")];
  const dataRows = trs.filter((tr) => tr.querySelectorAll("td").length > 0);
  return {
    ok: true,
    allTr: trs.length,
    dataRows: dataRows.length,
    headCells: [...trs[0].querySelectorAll("th,td")].map((c) => (c.textContent || "").trim()).filter(Boolean),
    first3: dataRows.slice(0, 3).map((tr) => [...tr.querySelectorAll("td")].map((td) => (td.textContent || "").trim())),
  };
});
console.log("RECIPE=" + JSON.stringify(recipe, null, 1));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-07.json", JSON.stringify({ added, tabs: r.tabs, recipe }, null, 2), "utf8");
await task.finish({ keep: [] });
