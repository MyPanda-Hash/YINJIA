const task = await taskSpace(51);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/form/QC_INSP?code=IJ-2026-11-0021", { timeout: 60000 });
await page.waitForTimeout(4000);
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r07-draft-form.png" });
const texts = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("span.act-name, li.act-item, .act, [class*=act]")) {
    const t = (el.textContent || "").replace(/\s+/g, "").trim();
    if (t && t.length <= 6) out.push(t);
  }
  return [...new Set(out)].slice(0, 40);
});
console.log({ shot, acts: texts });
