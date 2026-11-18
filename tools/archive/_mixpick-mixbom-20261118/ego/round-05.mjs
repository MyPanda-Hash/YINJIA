const task = await taskSpace(17)
const page = task.page('p1')
const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const hits = []
  document.querySelectorAll('*').forEach((el) => {
    const t = txt(el)
    if (t && t.length < 40 && /退出|切换|工厂|YJ_TEST|YINJIA-MES·测试/.test(t) && el.children.length === 0) {
      hits.push({ t, cls: el.className || '', tag: el.tagName })
    }
  })
  return { hits: hits.slice(0, 30) }
})
console.log(JSON.stringify(info, null, 2))
