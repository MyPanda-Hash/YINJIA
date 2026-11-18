import fsp from 'node:fs/promises'

const DIR = 'C:/Users/Lenovo/ego/gen-lines-select-all-20261118'
const task = await taskSpace('gen-lines-select-all-20261118')
const page = task.page('p1')

const info = await page.evaluate(() => {
  const hits = []
  const all = document.querySelectorAll('body *')
  for (const el of all) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
    if (own && /生单|合单/.test(own)) {
      hits.push({ tag: el.tagName, cls: String(el.className).slice(0, 90), text: own.slice(0, 30), role: el.getAttribute('role') || '', parentCls: String(el.parentElement?.className || '').slice(0, 90) })
    }
  }
  return { count: hits.length, hits: hits.slice(0, 40), tags: [...new Set([...document.querySelectorAll('body *')].map((e) => e.tagName))] }
})
console.log(JSON.stringify(info, null, 2))
