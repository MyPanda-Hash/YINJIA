const task = await taskSpace(51);
const page = task.page("p1");
await page.fill('input[placeholder="请输入登录账号"]', "Smm");
await page.fill('input[placeholder="请输入登录密码"]', "123456");
await page.click('loc=role:button[name="进入系统"]', { label: "登录" });
await page.waitForTimeout(5000);
console.log({ url: await page.url() });
const who = await page.evaluate(() => ({
  user: [...document.querySelectorAll("button")].map((b) => (b.innerText || "").replace(/\s+/g, "")).filter((t) => t && t.length < 12).slice(-6),
  msgBtn: document.querySelector('button[aria-label*="消息"]')?.getAttribute("aria-label"),
  factoryTag: [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).find((t) => t.includes("测试库")) || "",
}));
console.log({ who });
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r14-smm-login.png" });
console.log({ shot });
