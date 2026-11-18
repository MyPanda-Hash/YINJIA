const task = await taskSpace(52);
const page = task.page("p1");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// 1) 点「登录工厂」的 wrapper 打开下拉
const opened = await page.evaluate(() => {
  const item = [...document.querySelectorAll(".el-form-item")].find((f) => (f.innerText || "").includes("登录工厂"));
  const wrap = item?.querySelector(".el-select__wrapper");
  if (!wrap) return "no-wrapper";
  wrap.click();
  return "clicked";
});
await page.waitForTimeout(900);
const opts = await page.evaluate(() =>
  [...document.querySelectorAll("li.el-select-dropdown__item")]
    .filter((el) => el.offsetParent !== null)
    .map((el) => ({ text: (el.innerText || "").replace(/\s+/g, " ").trim(), cls: el.className })));
console.log({ opened, opts });

const picked = await page.evaluate(() => {
  const li = [...document.querySelectorAll("li.el-select-dropdown__item")]
    .find((el) => el.offsetParent !== null && (el.innerText || "").includes("测试库"));
  if (!li) return "no-option";
  li.click();
  return "picked";
});
await page.waitForTimeout(700);
const shown = await page.evaluate(() => {
  const item = [...document.querySelectorAll(".el-form-item")].find((f) => (f.innerText || "").includes("登录工厂"));
  return (item?.querySelector(".el-select__placeholder")?.innerText || "").trim();
});
console.log({ picked, shown });

// 2) 登录 jxg
await page.fill('input[placeholder="请输入登录账号"]', "jxg");
await page.fill('input[placeholder="请输入登录密码"]', "123456");
await page.click('loc=role:button[name="进入系统"]', { label: "登录仓库审核 jxg" });
await page.waitForTimeout(5000);
const state = await page.evaluate(() => ({
  url: location.hash,
  factory: localStorage.getItem("mes_factory"),
  badge: document.querySelector('button[aria-label*="消息"]')?.getAttribute("aria-label"),
}));
console.log(JSON.stringify(state));
