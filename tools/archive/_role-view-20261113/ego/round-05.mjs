// round-05.mjs —— 摸清工具栏真实 DOM(哪个元素承载「更多」)
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

// 关掉可能残留的下拉
await page.evaluate(() => document.body.click())
await page.waitForTimeout(400)

const dump = await page.evaluate(() => {
  const out = []
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (el.children.length === 0 && ['更多', '表格调整', '表头调整', '导出报表', '打印'].includes(t)) {
        out.push({ text: t, tag: el.tagName, cls: el.className, parentCls: el.parentElement?.className })
      }
    }
  }
  walk(document)
  // 工具栏容器(含「更多」的最近公共容器)
  const more = [...document.querySelectorAll('*')].find((e) => (e.textContent || '').replace(/\s+/g, '').trim() === '更多' && e.children.length === 0)
  const bar = more?.closest('div[class*="toolbar"], div[class*="tb-"], div[class*="action"]')
  return { hits: out, barHtml: bar ? bar.outerHTML.slice(0, 1200) : null, barCls: bar?.className }
})
console.log(JSON.stringify(dump, null, 1).slice(0, 4000))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-05-toolbar.png' })
