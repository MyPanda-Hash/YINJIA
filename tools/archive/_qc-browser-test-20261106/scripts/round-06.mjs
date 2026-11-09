// ego round-06: 采集制程检验单纸张事实 + 截图(只读)
const task = await taskSpace(9);
const page = task.page("p1");
await page.waitForTimeout(500);
const facts = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  // 纸张表头:th.qr-label + 对应 value 格
  const headRows = q(".qr-head-table tr").map((tr) => {
    const cells = [...tr.children];
    const pairs = [];
    for (let i = 0; i < cells.length; i += 2) {
      const th = cells[i], td = cells[i + 1];
      if (!th || !td) continue;
      const ctrl = td.querySelector("input, textarea, .el-select, .el-date-editor");
      pairs.push({ label: txt(th), kind: ctrl ? (ctrl.tagName + (ctrl.className || "").toString().slice(0, 40)) : "text", value: ctrl ? (ctrl.value ?? txt(ctrl)) : txt(td) });
    }
    return pairs;
  });
  // 明细表
  const grid = q(".qr-grid tbody tr").map((tr) => [...tr.children].map((td) => ({
    text: txt(td).slice(0, 30),
    ctrl: td.querySelector("input,textarea,.el-select") ? td.querySelector("input,textarea,.el-select").className.toString().slice(0, 60) : "",
  })));
  // 表尾
  const foot = q(".qr-foot-table tr").map((tr) => [...tr.children].map((c) => ({ tag: c.tagName, text: txt(c).slice(0, 24) })));
  // 侧栏按钮
  const side = q(".as-side-btn").map((b) => ({ text: txt(b), disabled: b.className.includes("disabled") }));
  const sel = q(".qr-grid .el-select").length;
  const verdictCells = q(".qr-grid td.c-verdict").map((td) => ({ isSelect: !!td.querySelector(".el-select"), text: txt(td).slice(0, 20) }));
  return {
    url: location.hash,
    docNo: document.querySelector(".doc-select-rail") ? "" : "",
    headRows, grid, foot, side, selectCount: sel, verdictCells,
    paperText: txt(document.querySelector(".qr-sheet")).slice(0, 500),
  };
});
console.log(JSON.stringify(facts, null, 1));
const path = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/round06-paper.png" });
console.log("shot=" + path);
