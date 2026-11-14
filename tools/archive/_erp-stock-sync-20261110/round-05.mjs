// round-05:用「模糊搜索」过滤出 PI-2026-10-0104,并列出可点击的工具栏动作
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')

await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('模糊搜索'))
  if (inp) setVal(inp, 'PI-2026-10-0104')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询')
  if (btn) btn.click()
})
await page.waitForTimeout(5000)

const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].slice(0, 8).map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
  const actEls = [...document.querySelectorAll('*')].filter((el) => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
    return t === '审核' && el.children.length <= 3
  }).map((el) => ({ tag: el.tagName, cls: el.className, txt: (el.textContent || '').trim() })).slice(0, 8)
  return { rows: rows.slice(0, 5), rowCount: rows.length, actEls }
})
console.log(JSON.stringify(info, null, 1).slice(0, 1500))
