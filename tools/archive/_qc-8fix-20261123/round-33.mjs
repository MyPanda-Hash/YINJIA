// round-33: 查询区提交——Enter 或查询区内的「查询」按钮
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
// 当前输入框已有 ZC-2026-11-0008;先按 Enter
await page.keyboard.press('Enter')
await page.waitForTimeout(4500)
const s1 = await page.evaluate(() => ({
  total: (document.body.innerText || '').match(/共\s*(\d+)\s*条/)?.[1] || '',
  rows: document.querySelectorAll('.el-table__body tr').length,
  first: (document.querySelector('.el-table__body tr')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
}))
console.log('after Enter:', JSON.stringify(s1))
// 列出所有「查询」按钮位置
console.log('buttons:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('button, .el-button')].filter((b) => (b.innerText || '').trim() === '查询').map((b) => {
  const r = b.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
}))))
