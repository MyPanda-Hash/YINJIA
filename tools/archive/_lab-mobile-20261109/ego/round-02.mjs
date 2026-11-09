const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(1500)
// 打开工厂切换(顶栏左上角那个 YINJIA-MES 按钮)
await page.click('loc=role:button[name="YINJIA-MES"]')
await page.waitForTimeout(1200)
const dlg = await page.evaluate(() => ({
  dialogTitle: [...document.querySelectorAll('.el-dialog__title')].map((e) => e.textContent.trim()),
  options: [...document.querySelectorAll('.el-dialog .el-select, .el-dialog .el-radio, .el-dialog li')]
    .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 20),
  buttons: [...document.querySelectorAll('.el-dialog button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
}))
console.log(JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-02.png' })
