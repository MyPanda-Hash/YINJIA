const task = await taskSpace(1);
const page = task.page("p1");
const info1 = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.el-table th')].map((x) => x.innerText.trim()).filter(Boolean)
  const rows = document.querySelectorAll('.el-table__body tbody tr').length
  const err = [...document.querySelectorAll('.el-message--error, .el-alert')].map((x) => x.innerText.trim())
  return { headers: [...new Set(ths)].slice(0, 40), rows, err }
})
console.log("MATERIAL_OUT=" + JSON.stringify(info1))
await page.goto("http://36.140.66.163:8090/#/prod/plan/workOrderBoard");
await page.waitForTimeout(5000);
const info2 = await page.evaluate(() => {
  const title = document.title
  const buttons = [...document.querySelectorAll('button')].map((x) => x.innerText.trim()).filter(Boolean)
  const rows = document.querySelectorAll('.el-table__body tbody tr, .wb-line, .wpb-grid-row').length
  const err = [...document.querySelectorAll('.el-message--error, .el-alert')].map((x) => x.innerText.trim())
  return { title, buttons: [...new Set(buttons)].slice(0, 30), rows, err }
})
console.log("WORK_ORDER_BOARD=" + JSON.stringify(info2))
const shot = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_deploy-20261127/round-04-work-order-board.png" });
console.log("SHOT=" + shot)
