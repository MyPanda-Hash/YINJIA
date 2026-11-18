// round-21:一次跑完(新文档 → 加行 → 点开下拉 → 抓 DOM/实例),避免跨轮状态漂移
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('about:blank')
await page.goto('http://localhost:5173/?cb=' + Date.now() + '#/panelx/list/RD_INSP_PLAN?new=1', { timeout: 60000 })
await page.waitForTimeout(10000)
await page.evaluate(() => { document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => b.click()) })
await page.waitForTimeout(600)
// 关掉可能存在的空行弹窗后加一行
await page.evaluate(() => { const a = document.querySelector('.rs-add'); if (a) a.click() })
await page.waitForTimeout(1500)
const pre = await page.evaluate(() => {
  const sel = document.querySelector('table.rs-dt td.rs-td .el-select')
  return {
    hasSelect: !!sel,
    rowCount: document.querySelectorAll('table.rs-dt tbody tr').length,
    cellHtml: sel ? sel.outerHTML.slice(0, 300) : null,
    selects: document.querySelectorAll('table.rs-dt td.rs-td .el-select').length,
  }
})
console.log('pre:', JSON.stringify(pre, null, 2))
const box = await page.evaluate(() => {
  const sel = document.querySelector('table.rs-dt td.rs-td .el-select')
  if (!sel) return null
  const r = sel.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('box:', JSON.stringify(box))
if (box) {
  await page.mouse.click(box.x, box.y)
  await page.waitForTimeout(1800)
}
console.log(JSON.stringify(await page.evaluate(() => {
  const poppers = [...document.querySelectorAll('.el-popper')].filter((p) => p.getBoundingClientRect().height > 0)
  const sel = document.querySelector('table.rs-dt td.rs-td .el-select')
  let selectState = null
  try {
    const inst = sel.__vueParentComponent
    const st = inst.setupState || {}
    selectState = {
      hasStates: 'states' in st,
      optionCount: st.states && st.states.options ? st.states.options.size : null,
      optionsArray: st.states && st.states.optionsArray ? st.states.optionsArray.length : null,
      props: { multiple: inst.props.multiple, filterable: inst.props.filterable, allowCreate: inst.props.allowCreate },
    }
  } catch (e) { selectState = 'err ' + e.message }
  return {
    poppers: poppers.map((p) => ({ text: (p.textContent || '').replace(/\s+/g, ' ').slice(0, 120), html: p.outerHTML.slice(0, 300) })),
    optionEls: document.querySelectorAll('.el-select-dropdown__item').length,
    selectState,
  }
}), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-21.png' })
