const task = await taskSpace(51);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/form/QC_INSP?code=IJ-2026-11-0021", { timeout: 60000 });
await page.waitForTimeout(3500);

// 1) 打开工具栏「审批」下拉
const opened = await page.evaluate(() => {
  const items = [...document.querySelectorAll("span.act-name, li")].filter((el) => {
    const t = (el.textContent || "").replace(/\s+/g, "").trim();
    return t === "审批" && el.offsetParent !== null;
  });
  if (!items.length) return false;
  const target = items[0].closest("li, button, div[role=button], span") || items[0];
  target.click();
  return true;
});
console.log({ openedDropdown: opened });
await page.waitForTimeout(800);

const menu = await page.evaluate(() => {
  const vis = [...document.querySelectorAll("li.el-dropdown-menu__item")].filter((el) => el.offsetParent !== null);
  return vis.map((el) => (el.innerText || "").replace(/\s+/g, "").trim());
});
console.log({ visibleMenu: menu });
