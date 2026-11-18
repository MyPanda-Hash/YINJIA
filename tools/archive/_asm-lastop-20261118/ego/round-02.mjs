// round-02:定位「选生产工单」按钮到底挂在哪个节点上(只读)
const OUT = 'C:/Users/vigna/ego/ship-insp-lastop-20261118'
const task = await taskSpace('ship-insp-lastop-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 60000 })
await page.waitForTimeout(6000)

const info = await page.evaluate(() => {
  const hits = []
  const walk = (el, depth) => {
    if (depth > 12) return
    for (const child of el.children) {
      const t = (child.textContent || '').replace(/\s+/g, ' ').trim()
      if (t === '选生产工单' || t.includes('选生产工单')) {
        hits.push({
          tag: child.tagName,
          cls: child.className && String(child.className).slice(0, 120),
          text: t.slice(0, 40),
          parentTag: child.parentElement?.tagName,
          parentCls: String(child.parentElement?.className || '').slice(0, 120),
        })
        if (hits.length > 6) return
      }
      walk(child, depth + 1)
    }
  }
  walk(document.body, 0)
  return {
    bodyHas: (document.body.innerHTML || '').includes('选生产工单'),
    hits,
    asides: [...document.querySelectorAll('aside, .side, .right, [class*="action"]')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200))
      .filter(Boolean).slice(0, 8),
    clickables: [...document.querySelectorAll('[class*="btn"], .el-button, li, .op, .act')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t && t.length < 12).slice(0, 40),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: OUT + '/02-locate-button.png' })
await task.finish({ keep: [] })
