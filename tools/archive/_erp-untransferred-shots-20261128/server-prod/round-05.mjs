// server round-05: 清存储 → 强制整页重载到登录页 → 打印控件
const task = await taskSpace(18);
const page = task.page("p1");
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
await page.goto("http://36.140.66.163:8090/?r=" + Date.now() + "#/login", { timeout: 60000 });
await page.waitForTimeout(5000);
const info = await page.evaluate(() => ({
  hash: location.hash,
  text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 400),
  buttons: [...document.querySelectorAll("button")].map((b) => (b.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 20),
  inputs: [...document.querySelectorAll("input")].map((i) => ({ ph: i.placeholder, type: i.type, value: i.value })),
  combos: [...document.querySelectorAll(".el-select,.el-input__inner[readonly]")].map((el) => (el.textContent || el.value || "").trim()).slice(0, 10),
}));
console.log(JSON.stringify(info, null, 2));
