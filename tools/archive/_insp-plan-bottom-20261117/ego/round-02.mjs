// round-02:看右侧操作按钮 / 顶栏(找登录工厂切换) / 滚到表格最下层截图
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(5000)
console.log(JSON.stringify(await page.evaluate(() => {
  const btn = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const right = [...document.querySelectorAll('.px-side button, .px-right button, .px-tools button, aside button')].map(btn)
  const allBtns = [...document.querySelectorAll('button')].map(btn).filter((t) => t && t.length < 20)
  const selects = [...document.querySelectorAll('.el-select')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  // 表格最下层:找 footerField 那一格
  const ff = document.querySelector('.rsp-footer-field')
  const dt = document.querySelector('table.rs-dt')
  return {
    rightButtons: right.slice(0, 30),
    allButtons: [...new Set(allBtns)].slice(0, 60),
    selects,
    hasFooterField: !!ff,
    footerText: ff ? (ff.textContent || '').replace(/\s+/g, ' ').slice(0, 400) : null,
    lastDtRows: dt ? [...dt.querySelectorAll('tr')].slice(-4).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)) : null,
    dtWidth: dt ? dt.getBoundingClientRect().width : null,
    colWidths: dt ? [...dt.querySelectorAll('colgroup col')].map((c) => c.getBoundingClientRect().width) : null,
  }
}), null, 2))
// 滚到最下面看底部合并格
await page.evaluate(() => {
  const dt = document.querySelector('table.rs-dt')
  if (dt) dt.scrollIntoView({ block: 'end' })
  const wrap = document.querySelector('.rs-scroll, .px-sheet, .rsp-dt-wrap')
  const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 200)
  for (const e of sc) e.scrollTop = e.scrollHeight
})
await page.waitForTimeout(1200)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-02.png' })
