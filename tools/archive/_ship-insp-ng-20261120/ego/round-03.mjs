const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 40000 })
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const clickables = [...document.querySelectorAll('*')].filter((el) => {
    const t = txt(el)
    return t && t.length < 12 && /管理员|退出|admin/i.test(t) && el.children.length <= 2
  }).slice(0, 12).map((el) => ({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), text: txt(el) }))
  return { title: document.title, hash: location.hash, clickables, bodyHead: txt(document.body).slice(0, 300) }
})
console.log(JSON.stringify(info, null, 2))
