// server round-01: 打开服务器 UI,登录,深链到 PI-2026-11-0183,量取明细行
const task = await taskSpace("server-pin-noterp-shots-20261128");
const page = task.page("p1");
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1680, height: 1500, deviceScaleFactor: 1, mobile: false });
await page.goto("http://36.140.66.163:8090/#/panelx/list/PURCHASE_IN?docNo=PI-2026-11-0183", { timeout: 60000 });
await page.waitForTimeout(6000);

const st = await page.evaluate(() => ({
  hash: location.hash,
  needLogin: !!(document.querySelector('input[placeholder*="账号"]') || (document.body.innerText || "").includes("进入系统")),
  text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 300),
}));
console.log(JSON.stringify(st, null, 2));

if (st.needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      s.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const ins = [...document.querySelectorAll("input")];
    setVal(ins.find((i) => (i.placeholder || "").includes("账号")), "admin");
    setVal(ins.find((i) => (i.placeholder || "").includes("密码")), "123456");
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("进入系统"));
    if (btn) btn.click();
  });
  await page.waitForTimeout(7000);
  console.log("after login: " + (await page.evaluate(() => location.hash)));
  await page.goto("http://36.140.66.163:8090/#/panelx/list/PURCHASE_IN?docNo=PI-2026-11-0183", { timeout: 60000 });
  await page.waitForTimeout(6000);
}

const info = await page.evaluate(() => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const rows = [...document.querySelectorAll("table tr")].filter((tr) => tr.getBoundingClientRect().width > 500);
  return {
    hash: location.hash,
    viewport: { w: innerWidth, h: innerHeight },
    docHeight: document.documentElement.scrollHeight,
    head: norm(document.body.innerText).slice(0, 260),
    rows: rows.slice(0, 22).map((el) => ({ rect: R(el), text: norm(el.innerText).slice(0, 110) })),
  };
});
console.log(JSON.stringify(info, null, 2));
console.log({ shot: await page.screenshot({ path: "C:/Users/Lenovo/ego/server-pin-noterp-20261128/plain-0183.png" }) });
