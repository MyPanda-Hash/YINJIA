// round-12.mjs —— 探登录页「登录工厂」控件(要为正式账套 YJ 也验一遍)
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const els = [...document.querySelectorAll('input, select, button, .el-select, [class*="factory"], [class*="login"]')]
  return {
    hash: location.hash,
    inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder || '', type: i.type, cls: i.className })),
    selects: [...document.querySelectorAll('.el-select__selected-item, .el-select__placeholder, select')].map((e) => ({ tag: e.tagName, text: (e.innerText || '').trim(), cls: e.className })).slice(0, 10),
    buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 10),
    bodySnippet: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
    total: els.length,
  }
})
console.log(JSON.stringify(info, null, 2))
await task.finish({ keep: [] })
