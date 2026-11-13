// round-05:带 Bearer token 直接打弹窗接口,拿到服务端真实报错
const task = await taskSpace("material-label-box-qty-20261111");
const page = task.page("p1");
const out = await page.evaluate(async () => {
  const token = localStorage.getItem("mes_token");
  const orderNo = "YJ-20261013-01";
  const r = await fetch("/api/px/puLabel/dialog?orderNo=" + encodeURIComponent(orderNo), {
    headers: { Authorization: "Bearer " + token, "Accept-Language": "zh-CN" },
  });
  const text = await r.text();
  return { hasToken: !!token, status: r.status, body: text.slice(0, 800) };
});
console.log(JSON.stringify(out, null, 2));
