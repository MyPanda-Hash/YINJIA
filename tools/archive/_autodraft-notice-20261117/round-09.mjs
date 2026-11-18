const task = await taskSpace(51);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/form/QC_INSP?code=IJ-2026-11-0021", { timeout: 60000 });
await page.waitForTimeout(3500);
const dump = await page.evaluate(() => {
  const all = [...document.querySelectorAll("div,ul")];
  const cand = all.find((el) => {
    const t = (el.innerText || "").replace(/\s+/g, "");
    return t.startsWith("新增选单修改保存删除审批") && t.length < 120;
  });
  return cand ? { cls: (cand.className || "").toString(), html: cand.outerHTML.slice(0, 2600) } : null;
});
console.log(JSON.stringify(dump, null, 1));
