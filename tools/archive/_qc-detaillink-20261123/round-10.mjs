// round-10.mjs —— 探:出货检验（表观）左栏状态页签的真实选择器(round-09 用 .doc-status 打偏了)
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const URL = 'http://localhost:5173/#/panelx/list/QC_ASM_INSP?docNo=ZJ-2026-11-0009'
await page.goto(URL, { timeout: 30000 })
await page.waitForTimeout(4000)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto(URL, { timeout: 30000 })
  await page.waitForTimeout(9000)
} else {
  await page.waitForTimeout(6000)
}
const res = await page.evaluate(() => {
  const hits = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    const t = (node.nodeValue || '').trim()
    if (['未完成', '已完成', '全部'].includes(t)) {
      const p = node.parentElement
      hits.push({ t, tag: p.tagName, cls: p.className, clsParent: p.parentElement?.className || '' })
    }
  }
  const cnt = (document.body.innerText.match(/共有数据\s*(\d+)\s*条/) || [])[1] || ''
  return { hits: hits.slice(0, 12), count: cnt, tabRoots: [...document.querySelectorAll('[class*="rail-tab"],[class*="dsr-tab"],[class*="status-tab"]')].map((e) => e.className).slice(0, 8) }
})
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detaillink-20261123/round-10-rail-tabs.png' })
console.log(JSON.stringify(res, null, 2))
await task.finish({ keep: [] })
