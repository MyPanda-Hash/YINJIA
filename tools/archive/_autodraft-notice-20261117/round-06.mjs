const task = await taskSpace(51);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/form/QC_INSP?code=IJ-2026-11-0021", { timeout: 60000 });
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
  const hits = [];
  for (const el of document.querySelectorAll("body *")) {
    const t = (el.textContent || "").replace(/\s+/g, "").trim();
    if (t === "审核" && el.children.length <= 1) {
      let p = el;
      const chain = [];
      for (let i = 0; i < 4 && p; i++) { chain.push(p.tagName + "." + (p.className || "").toString().replace(/\s+/g, ".")); p = p.parentElement; }
      hits.push({ tag: el.tagName, cls: (el.className || "").toString(), chain });
    }
  }
  const toolbar = document.querySelector("[class*=toolbar], [class*=tool-bar], [class*=dt-tool]");
  return { hits: hits.slice(0, 6), toolbarCls: toolbar ? (toolbar.className || "").toString() : null,
           toolbarText: toolbar ? toolbar.innerText.replace(/\s+/g, " ") : null };
});
console.log(JSON.stringify(info, null, 1));
