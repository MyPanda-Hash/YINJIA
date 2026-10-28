const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");

const BASE = "http://127.0.0.1:4173/";

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

// 看前端实际用的 storage 键
const keys = await page.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    out[k] = String(localStorage.getItem(k)).slice(0, 40);
  }
  return out;
});
console.log("LOCALSTORAGE_KEYS=" + JSON.stringify(Object.keys(keys)));

const ss = await page.evaluate(() => {
  const out = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    out[k] = String(sessionStorage.getItem(k)).slice(0, 40);
  }
  return out;
});
console.log("SESSIONSTORAGE_KEYS=" + JSON.stringify(Object.keys(ss)));

// 当前 URL 与登录后跳转
console.log("URL_AFTER=" + page.url());

// 页面可见文字(前 300 字),判断停在登录页还是已进主界面
const txt = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 400));
console.log("BODY_TEXT=" + txt);

await task.finish({ keep: [] });
