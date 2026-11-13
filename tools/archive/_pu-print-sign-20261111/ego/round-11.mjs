// round-11:读上次出纸的「供方/需方」块 → 新增联系人(接口)→ 复开弹窗验证选项 → 选中它再打一次
const task = await taskSpace("pu-print-sign-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

// ① 上一次「银嘉采购订单」的签章块内容
const sign = await page.evaluate(() => {
  const host = document.getElementById("yj-print-host");
  const boxes = host ? [...host.querySelectorAll(".sign .box")] : [];
  return {
    hasHost: !!host,
    h1: (host?.innerHTML.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1] || "",
    boxes: boxes.map((b) => (b.innerText || b.textContent || "").replace(/\s+/g, " ").trim()),
  };
});
log("上次纸面签章块:", JSON.stringify(sign, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-11-sign.png" });

// ② 新增联系人(接口,等价于弹窗里"填了新名字/新电话后打印")
const added = await page.evaluate(async () => {
  const token = localStorage.getItem("mes_token");
  const r = await fetch("/api/px/puPrint/buyerContacts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ 姓名: "测试联系人A", 联系方式: "13900002222" }),
  });
  const t = await r.text();
  return { status: r.status, body: t.slice(0, 300) };
});
log("新增联系人:", JSON.stringify(added, null, 2));

// ③ 复开弹窗:下拉里应出现新联系人
await page.evaluate(() => document.querySelectorAll(".el-dialog__headerbtn").forEach((b) => { try { b.click(); } catch (e) {} }));
await sleep(1300);
await page.evaluate(() => {
  const r = document.querySelector(".el-table__body .el-table__row");
  if (r) { r.querySelector("td")?.click(); r.click(); }
});
await sleep(1500);
await page.evaluate(() => {
  const g = [...document.querySelectorAll(".tb-group")].find((x) => (x.querySelector(".tb-main")?.textContent || "").trim() === "打印");
  g?.querySelector(".tb-main")?.click();
});
const opened = await page.waitForSelector(".pup", { timeout: 25000 }).then(() => true).catch(() => false);
log("dialog:", opened);
await sleep(3000);

// 打开「需方联系人」下拉
await page.evaluate(() => {
  const s = document.querySelector(".pup-buyer .el-select");
  s?.click();
});
await sleep(1200);
const options = await page.evaluate(() => [...document.querySelectorAll(".el-select-dropdown__item")].map((e) => (e.textContent || "").trim()));
log("联系人下拉选项:", JSON.stringify(options));
await page.screenshot({ path: "C:/Users/Lenovo/ego/pu-print-sign-20261111/round-11-options.png" });

// 选中新联系人 → 电话应自动带出
const picked = await page.evaluate(() => {
  const item = [...document.querySelectorAll(".el-select-dropdown__item")].find((e) => (e.textContent || "").trim() === "测试联系人A");
  if (!item) return false;
  item.click();
  return true;
});
await sleep(1200);
const afterPick = await page.evaluate(() => ({
  items: [...document.querySelectorAll(".pup-buyer .pup-buyer-item")].map((s) => (s.textContent || "").replace(/\s+/g, " ").trim()),
}));
log("选中后:", JSON.stringify(afterPick, null, 2));
console.log("done");
