const task = await taskSpace(51);
const page = task.page("p1");
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://127.0.0.1:8090/#/login", { timeout: 60000 });
await page.waitForTimeout(2500);
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r13-login.png" });
const form = await page.evaluate(() => ({
  url: location.hash,
  inputs: [...document.querySelectorAll("input")].map((i) => ({ ph: i.placeholder || "", type: i.type, v: i.value })),
  buttons: [...document.querySelectorAll("button")].map((b) => (b.innerText || "").replace(/\s+/g, "")).filter(Boolean),
}));
console.log(JSON.stringify(form, null, 1));
console.log({ shot });
