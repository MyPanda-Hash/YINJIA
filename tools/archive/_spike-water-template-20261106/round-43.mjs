const task = await taskSpace("加标水模版设计器验证-20261106");
const page = task.page("p1");
const del = await page.evaluate(() => {
  const b = [...document.querySelectorAll(".el-message-box")].find((x) => { let p = x; while (p) { if (getComputedStyle(p).display === "none") return false; p = p.parentElement; } return true; });
  const btn = [...b.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "删除");
  const r = btn.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
await page.mouse.click(del.x, del.y, { label: "confirm delete template" });
await page.waitForTimeout(1600);
const st = await page.evaluate(async () => {
  const dlg = [...document.querySelectorAll(".el-dialog")].find((d) => ((d.querySelector(".el-dialog__title") || {}).innerText || "").includes("标准库维护"));
  const r = await fetch("/api/stdlib/list?lib=lab.test_item&all=1", { headers: { Authorization: "Bearer " + localStorage.getItem("mes_token") } });
  const b = await r.json();
  return {
    rows: dlg ? [...dlg.querySelectorAll("tbody tr")].map((tr) => (tr.innerText || "").replace(/\n/g, "|").slice(0, 30)) : [],
    items: (b.data || []).map((x) => x.item),
    msg: [...document.querySelectorAll(".el-message")].map((n) => n.innerText.trim()).slice(0, 3),
  };
});
console.log(JSON.stringify(st, null, 1));
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-tpl-20261106/after-delete.png" });
