// round-12:收尾——作废验证时落的两张报表打印记录(测试库),并核对需方联系人名单最终形态
const task = await taskSpace("pu-print-sign-20261111");
const page = task.page("p1");
const out = await page.evaluate(async () => {
  const token = localStorage.getItem("mes_token");
  const h = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const recs = await (await fetch("/api/px/puPrint/records?orderNo=YJ-20261013-01", { headers: h })).json();
  const list = (recs.data || []).map((r) => r["单据编号"]);
  const voided = [];
  for (const no of list) {
    const r = await fetch("/api/px/puPrint/void", { method: "POST", headers: h, body: JSON.stringify({ docNo: no }) });
    voided.push({ no, status: r.status, body: (await r.text()).slice(0, 120) });
  }
  const after = await (await fetch("/api/px/puPrint/records?orderNo=YJ-20261013-01", { headers: h })).json();
  const contacts = await (await fetch("/api/px/puPrint/buyerContacts", { headers: h })).json();
  return { before: list, voided, afterCount: (after.data || []).length, contacts: contacts.data };
});
console.log(JSON.stringify(out, null, 2));
