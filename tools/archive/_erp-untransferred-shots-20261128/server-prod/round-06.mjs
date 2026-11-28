// server round-06: 正式库登录 → 深链 0183 → 量取明细行
const task = await taskSpace(18);
const page = task.page("p1");
await page.fill('input[placeholder="请输入登录账号"]', "admin");
await page.fill('input[placeholder="请输入登录密码"]', "123456");
await page.click('text="进入系统"');
await page.waitForTimeout(9000);

const ok = await page.evaluate(() => ({
  hash: location.hash,
  factory: (document.body.innerText || "").match(/YINJIA-MES[·\w\u4e00-\u9fa5]*/g)?.slice(0, 4) || [],
  text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 160),
}));
console.log(JSON.stringify(ok, null, 2));

await page.goto("http://36.140.66.163:8090/#/panelx/list/PURCHASE_IN?docNo=PI-2026-11-0183", { timeout: 60000 });
await page.waitForTimeout(9000);

const info = await page.evaluate(() => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const rows = [...document.querySelectorAll("table tr")].filter((tr) => tr.getBoundingClientRect().width > 500);
  return {
    hash: location.hash,
    docHeight: document.documentElement.scrollHeight,
    header: norm(document.body.innerText).slice(0, 420),
    rows: rows.map((el) => ({ rect: R(el), text: norm(el.innerText).slice(0, 130) })),
  };
});
console.log(JSON.stringify(info, null, 2));
console.log({ shot: await page.screenshot({ path: "C:/Users/Lenovo/ego/server-pin-noterp-20261128/plain-0183-prod.png" }) });
