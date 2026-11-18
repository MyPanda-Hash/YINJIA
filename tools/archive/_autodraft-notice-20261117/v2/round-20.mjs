const task = await taskSpace(52);
const page = task.page("p1");
const res = await page.evaluate(async () => {
  const token = localStorage.getItem("mes_token");
  const r = await fetch("/api/portal/message/list?limit=5", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.text();
  const badge = await fetch("/api/portal/badge", { headers: { Authorization: `Bearer ${token}` } }).then((x) => x.text());
  return { status: r.status, body: body.slice(0, 700), badge };
});
console.log(JSON.stringify(res, null, 1));
