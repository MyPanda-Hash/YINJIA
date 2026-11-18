const task = await taskSpace(52);
const page = task.page("p1");
const api = await page.fetch("/api/portal/message/list?limit=5", { timeout: 10000 });
console.log("message/list", api.status, String(api.body).slice(0, 600));
const badge = await page.fetch("/api/portal/badge", { timeout: 10000 });
console.log("badge", badge.status, String(badge.body).slice(0, 400));
const ls = await page.evaluate(() => {
  const out = {};
  for (const k of Object.keys(localStorage)) out[k] = String(localStorage.getItem(k)).slice(0, 120);
  return out;
});
console.log("localStorage", JSON.stringify(ls, null, 1));
