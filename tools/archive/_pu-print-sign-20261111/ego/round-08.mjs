// round-08:直接打 getFormDescriptor,看 500 的真实报错
const task = await taskSpace("pu-print-sign-20261111");
const page = task.page("p1");
const out = await page.evaluate(async () => {
  const token = localStorage.getItem("mes_token");
  const h = { Authorization: "Bearer " + token, "Accept-Language": "zh-CN" };
  const r = await fetch("/api/px/getFormDescriptor?panelCode=PU_ORDER&code=" + encodeURIComponent("YJ-20261013-01"), { headers: h });
  const t = await r.text();
  return { status: r.status, body: t.slice(0, 700) };
});
console.log(JSON.stringify(out, null, 2));
