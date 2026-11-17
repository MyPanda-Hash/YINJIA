// round-05: 放大窗口后找功能按钮区(新增/保存/提交审批)
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', {
      windowId: w.windowId,
      bounds: { windowState: 'normal', width: 1680, height: 1000 },
    })
  }
  await page.waitForTimeout(600)
} catch (e) { console.log('resize skip: ' + e.message) }

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(7000)

const dom = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const cands = [...document.querySelectorAll('*')].filter((el) => {
    const t = txt(el)
    return el.children.length === 0 && /^(新增|保存|保存草稿|提交审批|打印|删除|导出)$/.test(t)
  })
  return {
    viewport: { w: innerWidth, h: innerHeight },
    found: cands.map((el) => ({
      t: txt(el),
      cls: String(el.className).slice(0, 60),
      vis: !!(el.offsetParent || el.getClientRects().length),
      rect: el.getBoundingClientRect ? { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y) } : null,
    })).slice(0, 20),
    funcZone: [...document.querySelectorAll('.func-zone, .panel-toolbar, .toolbar, .approval-side, .side-actions')]
      .map((e) => ({ cls: String(e.className).slice(0, 50), txt: txt(e).slice(0, 120) })).slice(0, 10),
  }
})
console.log(JSON.stringify(dom, null, 2))
await page.screenshot({ path: dir + '/shots/round-05-wide.png' })
