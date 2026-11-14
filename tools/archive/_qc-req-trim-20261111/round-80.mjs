const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
console.log('open=' + await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qc-bar-btn')].find((x) => /自定义字段/.test(x.textContent || ''))
  if (!el) return 'NO-BTN'
  el.click(); return 'OK'
}))
await page.waitForTimeout(2800)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return null
  return {
    title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(),
    labels: [...d.querySelectorAll('.el-form-item__label')].map((e) => (e.textContent || '').trim()),
    hasSub2: [...d.querySelectorAll('.el-form-item__label')].some((e) => (e.textContent || '').includes('子目录2')),
    addDisabled: (() => {
      const b = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
      return b ? b.disabled : null
    })(),
  }
})
console.log('dialog=' + JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-80-field-dialog.png' })
