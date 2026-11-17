// round-05: 先摸清面板工具栏的按钮 DOM(为点「自定义字段」找准确切选择器)
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 30000 })
await page.waitForTimeout(8000)
const info = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('button')].map((b) => ({ t: (b.textContent || '').replace(/\s+/g, ' ').trim(), cls: b.className, dis: b.disabled })),
  qs: [...document.querySelectorAll('[class*="qc-req"], [class*="sheet"]')].slice(0, 10).map((e) => e.tagName + '.' + e.className),
  custom: [...document.querySelectorAll('*')].filter((n) => (n.textContent || '').includes('自定义字段') && n.children.length <= 2).slice(0, 6).map((n) => n.tagName + '.' + n.className + ' :: ' + (n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
}))
console.log(JSON.stringify(info, null, 2))
console.log('done round-05')
