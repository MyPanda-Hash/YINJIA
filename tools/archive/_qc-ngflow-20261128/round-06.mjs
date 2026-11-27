const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')
const st = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog, .el-message-box')]
    .map((d) => (d.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  return {
    hash: location.hash,
    factory: (document.querySelector('span[aria-label*="YINJIA"]') || {}).textContent || '',
    dialogs: dlg,
    buttons: [...document.querySelectorAll('.el-dialog button, .el-message-box button')]
      .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log('DIALOG-STATE', JSON.stringify(st, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-06-dialog.png' })
