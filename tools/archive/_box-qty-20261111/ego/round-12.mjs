// round-12:把验证用的测试库打印单作废(释放预约,测试账套保持干净)+ 终态截图
const task = await taskSpace("material-label-box-qty-20261111");
const page = task.page("p1");
const out = await page.evaluate(async () => {
  const token = localStorage.getItem("mes_token");
  const r = await fetch("/api/px/puLabel/void", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ docNo: "MQ-2026-11-0006" }),
  });
  const text = await r.text();
  return { status: r.status, body: text.slice(0, 300) };
});
console.log(JSON.stringify(out, null, 2));
