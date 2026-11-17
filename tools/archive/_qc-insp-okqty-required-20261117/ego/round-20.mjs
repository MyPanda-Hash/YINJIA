// round-20: 摸清工具栏「审批」下拉的 DOM(为点「提交审批」定位)
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP', { timeout: 30000 })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(9000)
const info = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter((e) => e.offsetParent !== null && (e.textContent || '').trim() === '审批')
  const groups = els.map((e) => ({ tag: e.tagName, cls: e.className, html: e.outerHTML.slice(0, 200) }))
  const tb = [...document.querySelectorAll('.tb-main')].map((e) => ({ txt: (e.textContent || '').trim(), cls: e.className }))
  const containSubmit = [...document.querySelectorAll('*')]
    .filter((e) => e.offsetParent !== null && (e.textContent || '').includes('提交审批') && e.children.length <= 2)
    .map((e) => ({ tag: e.tagName, cls: e.className, txt: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) }))
  return { groups, tb, containSubmit }
})
console.log(JSON.stringify(info, null, 2))
console.log('done round-20')
