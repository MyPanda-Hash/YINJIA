const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.mouse.click(70, 400)
await page.waitForTimeout(2000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const vis = [...document.querySelectorAll('div,li,a,span')].filter((e) => e.offsetParent && e.children.length === 0 && /出货检验|首件检验|巡线检验|出厂检验/.test(txt(e))).map((e) => txt(e))
  return { links: [...new Set(vis)].slice(0, 20), body: txt(document.body).slice(0, 200) }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s33-menu-open.png' })
