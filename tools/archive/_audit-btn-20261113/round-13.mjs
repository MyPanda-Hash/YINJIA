// round-13: 把挡在前面的弹窗原文读全(为什么这张草稿审不了),然后逐个关掉,页面恢复干净。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
const boxes = await page.evaluate(() => [...document.querySelectorAll('.el-message-box')].map((b) => ({
  title: (b.querySelector('.el-message-box__title')?.textContent || '').trim(),
  body: (b.querySelector('.el-message-box__message')?.textContent || '').replace(/\s+/g, ' ').trim(),
  inputs: [...b.querySelectorAll('textarea, input')].length,
  btns: [...b.querySelectorAll('.el-message-box__btns button')].map((x) => (x.textContent || '').trim()),
})))
console.log('BOXES ' + JSON.stringify(boxes, null, 2))
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-13.json', JSON.stringify(boxes, null, 2), 'utf8')

// 关掉所有弹窗(点「取消」/「去填写」都给关)
await page.evaluate(() => {
  for (let i = 0; i < 4; i++) {
    const btn = [...document.querySelectorAll('.el-message-box__btns button')]
      .find((b) => /取消|去填写|知道了/.test(b.textContent || ''))
    btn?.click()
  }
})
await page.waitForTimeout(1500)
const left = await page.evaluate(() => document.querySelectorAll('.el-message-box').length)
console.log('BOXES_LEFT ' + left)
