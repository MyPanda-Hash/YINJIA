const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");

const URL = "http://127.0.0.1:4173/";

// 登录取 token(与既有探针同款:走 /api/auth/login,然后写 localStorage)
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

const login = await page.evaluate(async () => {
  const r = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: "admin", password: "123456", factory: "YJ" }),
  });
  const j = await r.json();
  return { status: r.status, keys: Object.keys(j || {}), data: j && j.data ? Object.keys(j.data) : null };
});
console.log("LOGIN_STATUS=" + login.status);
console.log("LOGIN_KEYS=" + JSON.stringify(login.keys));
console.log("LOGIN_DATA_KEYS=" + JSON.stringify(login.data));
console.log("LOGIN_BODY=" + JSON.stringify(login).slice(0, 500));

await task.finish({ keep: [] });
