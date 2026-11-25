// 第 20 轮:看有没有「未保存修改」拦截框 → 放弃 → 再切页签选单
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
const boxes = await page.evaluate(() => [...document.querySelectorAll('.el-message-box, .el-dialog, .el-overlay')].map((b) => ({
  cls: b.className,
  text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
  buttons: [...b.querySelectorAll('button')].map((x) => (x.textContent || '').trim()),
})))
console.log('boxes: ' + JSON.stringify(boxes, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-20.png' })
