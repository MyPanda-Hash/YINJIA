// 第 7 轮:看右侧按钮结构 → 提交审核 → 确认审核 → 只读态取证
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')

const msgBox = await page.evaluate(() => {
  const b = document.querySelector('.el-message-box')
  return b ? { text: (b.textContent || '').replace(/\s+/g, ' ').trim(), buttons: [...b.querySelectorAll('button')].map((x) => (x.textContent || '').trim()) } : null
})
console.log('open msgbox: ' + JSON.stringify(msgBox))

const side = await page.evaluate(() => {
  const side = document.querySelector('.approval-side')
  return side ? [...side.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').trim()).map((e) => ({
    tag: e.tagName, cls: e.className, text: (e.textContent || '').trim(),
    parent: e.parentElement?.className, parentTag: e.parentElement?.tagName,
  })).slice(0, 60) : null
})
console.log('side leaves: ' + JSON.stringify(side, null, 2))
