// round-07: 刷新后定位新单行, 打印 DOM 结构并点击
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(7000)
const info = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')]
  const leaf = all.filter((n) => n.children.length === 0 && (n.textContent || '').includes('ZC-2026-11-0010'))
  const out = leaf.slice(0, 3).map((n) => {
    const chain = []
    let p = n
    for (let i = 0; i < 7 && p; i++) { chain.push((p.className && typeof p.className === 'string' ? p.className : p.tagName).slice(0, 40)); p = p.parentElement }
    return { text: n.textContent.trim(), chain }
  })
  return { out, body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200) }
})
console.log(JSON.stringify(info, null, 1))
