// round-03:诊断——弹窗标题/行数/面板选中单据
const task = await taskSpace("material-label-box-qty-20261111");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const log = (...a) => console.log(...a);

const state = await page.evaluate(() => ({
  hash: location.hash,
  title: (document.querySelector(".el-dialog__title")?.textContent || "").trim(),
  dialogOpen: !!document.querySelector(".mlq"),
  rows: document.querySelectorAll(".mlq .el-table__body .el-table__row").length,
  emptyText: (document.querySelector(".mlq .el-table__empty-text")?.textContent || "").trim(),
  panelRows: document.querySelectorAll(".el-table__body .el-table__row").length,
  selectedRowText: (document.querySelector(".el-table__body .el-table__row.is-current-row, .el-table__body .el-table__row.current-row")?.textContent || "").replace(/\s+/g, " ").slice(0, 80),
  firstPanelRow: (document.querySelector(".el-table__body .el-table__row")?.textContent || "").replace(/\s+/g, " ").slice(0, 100),
  docRail: (document.querySelector(".doc-rail, .rail, aside")?.textContent || "").replace(/\s+/g, " ").slice(0, 120),
}));
log("state:", JSON.stringify(state, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/material-label-box-qty-20261111/round-03-state.png" });
