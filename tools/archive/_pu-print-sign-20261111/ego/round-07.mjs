// round-07:逐个打接口,定位那个 500
const task = await taskSpace("pu-print-sign-20261111");
const page = task.page("p1");
const out = await page.evaluate(async () => {
  const token = localStorage.getItem("mes_token");
  const h = { Authorization: "Bearer " + token, "Accept-Language": "zh-CN" };
  const urls = [
    "/api/px/puPrint/buyerContacts",
    "/api/px/puPrint/records?orderNo=YJ-20261013-01",
    "/api/px/puPrint/quotas?orderNo=YJ-20261013-01&format=%E6%9C%89%E9%87%91%E9%A2%9D",
    "/api/px/form/descriptor?panelCode=PU_ORDER&code=YJ-20261013-01",
  ];
  const res = [];
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: h });
      const t = await r.text();
      res.push({ u, status: r.status, body: t.slice(0, 260) });
    } catch (e) {
      res.push({ u, err: String(e && e.message) });
    }
  }
  return res;
});
console.log(JSON.stringify(out, null, 2));
