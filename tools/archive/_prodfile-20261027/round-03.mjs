const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";

// 1) 先注入 token(localStorage 口径与前端 store 一致),再进面板
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

const tok = await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: "admin", password: "123456", factory: "YJ" }),
  });
  const j = await r.json();
  return j?.data?.token || "";
});
console.log("TOKEN_LEN=" + tok.length);

await page.evaluate((t) => {
  localStorage.setItem("mes_token", t);
  localStorage.setItem("token", t);
  sessionStorage.removeItem("mes_at_login");
}, tok);

// 2) 直接进面板路由
await page.goto(BASE + "#/panelx/list/RD_MOLD_PROC", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector(".rsp-pages, .approval-sheet, .rsp-sheet", { state: "visible", timeout: 30000 });

// 3) 页签顺序 + 当前页
const tabs = await page.evaluate(() => {
  const els = [...document.querySelectorAll(".rsp-pages > *")];
  return els.map((e) => ({ text: (e.textContent || "").trim(), cls: e.className }));
});
console.log("TABS=" + JSON.stringify(tabs));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/out-01.json",
  JSON.stringify({ tokLen: tok.length, tabs }, null, 2), "utf8");

await task.finish({ keep: [] });
