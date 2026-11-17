const task = await taskSpace("start-system-20261110");
const page = task.page("p1");
// 直接按单据号打开手机单据页(只读查看,不做任何提交)
await page.goto("http://localhost:5173/#/panelx/list/MOBILE_PICK/doc?no=LL-2026-11-0016", { timeout: 40000 });
await page.waitForTimeout(6000);
try {
  const w = await page.cdp("Browser.getWindowForTarget", {});
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
} catch (e) {}
let st = await page.evaluate(() => {
  const t = (document.body.innerText || "").replace(/\s+/g, " ");
  return { hash: location.hash, len: t.length, text: t.slice(0, 900) };
});
console.log("DOC_TRY1 " + JSON.stringify(st, null, 2));
if (!/LL-2026-11-0016/.test(st.text)) {
  // 试同路径不带参数外的第二种形态:/m/pick 兼容地址
  await page.goto("http://localhost:5173/#/panelx/list/MOBILE_PICK", { timeout: 40000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const inp = [...document.querySelectorAll("input")].find((i) => (i.placeholder || "").includes("工单"));
    if (inp) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      s.call(inp, "LL-2026-11-0016");
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await page.waitForTimeout(800);
  await page.click("text=查询单据", { label: "query slip", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.click("text=打开单据", { label: "open slip", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(6000);
  st = await page.evaluate(() => {
    const t = (document.body.innerText || "").replace(/\s+/g, " ");
    return { hash: location.hash, len: t.length, text: t.slice(0, 1200),
      sentences: (t.match(/[^。;!?]{0,40}(材料出库单|生产退料单)[^。;!?]{0,50}/g) || []).slice(0, 10) };
  });
  console.log("DOC_TRY2 " + JSON.stringify(st, null, 2));
}
await page.screenshot({ path: "C:/Users/Lenovo/ego/start-system-20261110/round-16-mobile-doc.png" });
console.log("DONE");
