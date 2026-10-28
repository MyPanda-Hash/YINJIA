const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");

// 1) 打开构建产物(vite preview),确认页面挂载
await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });
console.log("TITLE=" + (await page.evaluate(() => document.title)));

// 2) 取入口 chunk,确认是这次构建的产物
const entry = await page.evaluate(() => {
  return [...document.querySelectorAll("script[type=module][src]")].map((s) => s.getAttribute("src"));
});
console.log("ENTRY=" + JSON.stringify(entry));

// 3) 有无 boot-fatal 红框(页面脚本异常会画在这里)
const fatal = await page.evaluate(() => {
  const b = document.getElementById("boot-fatal");
  return b ? b.textContent.slice(0, 300) : "";
});
console.log("FATAL=" + JSON.stringify(fatal));

await task.finish({ keep: [] });
