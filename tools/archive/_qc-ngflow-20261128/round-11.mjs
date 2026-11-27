const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(4000)

// 用顶栏「搜索产品功能」查菜单入口(比点展开树稳:直接给出 名称 + 路径)
const search = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const box = document.querySelector('input[placeholder*="搜索产品功能"]')
  if (!box) return { error: 'no-search-box' }
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  box.focus()
  setVal(box, '不合格品处理')
  await sleep(1500)
  const items = [...document.querySelectorAll('.el-autocomplete-suggestion li, .search-result-item, [class*="suggest"] li, [class*="result"] li')]
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  return { items: items.slice(0, 12) }
})
console.log('SEARCH', JSON.stringify(search, null, 1))

// 同时把「来料品质」展开(只点一次标题,不来回折)
const menu = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const t = [...document.querySelectorAll('.el-sub-menu__title')].find((x) => (x.textContent || '').includes('来料品质'))
  if (t) { t.click(); await sleep(1000) }
  return [...document.querySelectorAll('.el-menu-item')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
})
console.log('MENU-LEAVES', JSON.stringify(menu))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-11-menu.png' })
