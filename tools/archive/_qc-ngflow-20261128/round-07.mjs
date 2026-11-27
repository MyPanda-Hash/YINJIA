const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')
// 切换账套对话框:目标 = YINJIA-MES·测试库,需要输入测试账套密码
const info = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('.el-dialog input')].map((i) => ({
    ph: i.placeholder, type: i.type, cls: i.className,
  }))
  return { inputs, text: (document.querySelector('.el-dialog') || {}).innerText }
})
console.log('DLG', JSON.stringify(info, null, 1))
