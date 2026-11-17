const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(6000)
console.log(JSON.stringify(await page.evaluate(() => {
  const tools = document.querySelector('.tools')
  const items = tools ? [...tools.querySelectorAll('*')].filter((el) => el.children.length === 0 && (el.textContent || '').trim()) : []
  return {
    toolsHtmlHead: (tools?.outerHTML || '').slice(0, 1200),
    leafTexts: items.slice(0, 30).map((el) => ({ tag: el.tagName, cls: el.className, text: (el.textContent || '').trim().slice(0, 12) })),
  }
}), null, 2))
