const task = await taskSpace(52);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/login", { timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ timeout: 60000 });
await page.waitForTimeout(2000);
await page.waitForSelector('input[placeholder="请输入登录账号"]', { state: "visible", timeout: 20000 });

// 打开「登录工厂」下拉
const opened = await page.evaluate(() => {
  const sel = document.querySelector(".el-select");
  if (!sel) return "no-select";
  sel.querySelector("input")?.click();
  sel.click();
  return "clicked";
});
await page.waitForTimeout(800);
const opts = await page.evaluate(() =>
  [...document.querySelectorAll("li.el-select-dropdown__item")]
    .filter((el) => el.offsetParent !== null)
    .map((el) => (el.innerText || "").trim()));
console.log({ opened, opts });
