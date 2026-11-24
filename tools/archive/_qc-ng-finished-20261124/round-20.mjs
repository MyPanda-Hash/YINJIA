// round-20.mjs —— 新单据《不合格品处理单(成品)》QC_BHCP 页面落地自检(2026-11-24,只读)
//  ① 路由 /panelx/list/QC_BHCP 能开、无报错;② 纸面标题/右上信息表;③ 左栏「单据选择」有三列(产品编码中间列);
//  ④ 工具栏按钮组(提交审批/审批通过/打印/保存…)是否下发。
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const SHOT = 'C:/Users/vigna/ego/qc-bhcp-20261124'

await page.goto('http://localhost:5173/#/panelx/list/QC_BHCP', { timeout: 45000 })
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
  await page.waitForTimeout(8000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_BHCP', { timeout: 45000 })
}
await page.waitForTimeout(9000)
const info = await page.evaluate(() => {
  const text = (document.body.innerText || '').replace(/\s+/g, ' ')
  const title = document.querySelector('.as-title')?.innerText?.trim() || ''
  const infoCells = [...document.querySelectorAll('.as-info-table .k, .as-info-table .as-info-k, .as-info-table th, .as-info-table td')]
    .map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 8)
  const railHeads = [...document.querySelectorAll('.doc-select-rail th')].map((e) => (e.innerText || '').trim()).filter(Boolean)
  const btns = [...document.querySelectorAll('.as-side .as-side-btn, .as-side-btns .as-side-btn, .toolbar .tb-main')]
    .map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 20)
  return {
    hash: location.hash,
    docTitle: document.title,
    paperTitle: title,
    bodyHead: text.slice(0, 160),
    infoCells,
    railHeads,
    buttons: btns,
    hasError: /失败|错误|异常/.test(text.slice(0, 400)),
  }
})
console.log(JSON.stringify(info, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
  await page.screenshot({ path: SHOT + '/round-20-bhcp-panel.png' })
  console.log('SHOT OK')
} catch (e) { console.log('SHOT SKIP: ' + e.message.slice(0, 110)) }
await task.finish({ keep: [] })
