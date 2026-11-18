const task = await taskSpace(51);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/form/QC_INSP?code=IJ-2026-11-0019", { timeout: 60000 });
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")]
    .map((b) => (b.innerText || "").replace(/\s+/g, ""))
    .filter((t) => t && t.length <= 12);
  const inputs = [...document.querySelectorAll("input")]
    .slice(0, 12)
    .map((i) => ({ ph: i.placeholder || "", v: i.value || "" }));
  return { url: location.hash, buttons: [...new Set(btns)], inputs };
});
console.log(JSON.stringify(info, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r04-form.png" });
console.log({ shot });
