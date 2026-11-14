const task = await taskSpace('tab-title-flip-20261111')
const page = task.page('p1')
const errs = []
page.on?.('console', (m) => { if (m.type && m.type() === 'error') errs.push(m.text()) })

await page.goto('http://localhost:5173/#/panelx/list/SO_ORDER', { timeout: 60000 })
await page.evaluate(() => location.reload())
await page.waitForTimeout(7000)

const read = () => {
  const tabs = [...document.querySelectorAll('.tabsbar .tab')].map((el) => (el.querySelector('span')?.textContent || '').replace(/\s+/g, ' ').trim())
  const act = [...document.querySelectorAll('.tabsbar .tab')].findIndex((el) => el.classList.contains('active'))
  const chips = [...document.querySelectorAll('.doc-chip')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
  const firstRow = (document.querySelector('.el-table__row')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  return { hash: location.hash, tabs, act, chip: chips[0] || '', firstRow }
}
const clickTab = async (name, wait = 3000) => {
  await page.evaluate((nm) => {
    const el = [...document.querySelectorAll('.tabsbar .tab')].find((t) => (t.querySelector('span')?.textContent || '').trim() === nm)
    if (el) el.click()
  }, name)
  await page.waitForTimeout(wait)
}

// 1) 打开 销售订单 + 采购订单 两张页签
await page.evaluate(() => { location.hash = '#/panelx/list/PU_ORDER' })
await page.waitForTimeout(4000)
await page.evaluate(() => { location.hash = '#/panelx/list/SO_ORDER' })
await page.waitForTimeout(5000)
const before = await page.evaluate(read)
console.log('SO_ORDER 打开态 ' + JSON.stringify(before))

// 2) 切到采购订单再切回：当前单据应保持同一张（不退回第一张 / 不清空）
await clickTab('采购订单', 3000)
const mid = await page.evaluate(read)
await clickTab('销售订单', 4000)
const back = await page.evaluate(read)
console.log('切走 ' + JSON.stringify({ act: mid.act, tabs: mid.tabs }))
console.log('切回 ' + JSON.stringify(back))
console.log(back.chip === before.chip ? `PASS 切回仍是同一张(${back.chip})` : `CHECK 切回单据变了 before=${before.chip} after=${back.chip}`)

// 3) 表单页签(PanelxForm)：开一张表单页，切走再回来，名字与内容都不能被别人改
await page.evaluate(() => { location.hash = '#/panelx/form/RD_APPROVAL' })
await page.waitForTimeout(6000)
const form = await page.evaluate(read)
console.log('FORM 打开 ' + JSON.stringify({ hash: form.hash, tabs: form.tabs, act: form.act, chip: form.chip }))
await clickTab('销售订单', 3500)
const afterSw = await page.evaluate(read)
console.log('FORM 切走后页签名 ' + JSON.stringify(afterSw.tabs))
const formName = form.tabs[form.act]
await clickTab(formName, 3500)
const formBack = await page.evaluate(read)
console.log('FORM 切回 ' + JSON.stringify({ hash: formBack.hash, act: formBack.act, tabs: formBack.tabs, chip: formBack.chip }))
console.log(formBack.tabs[formBack.act] === formName ? 'PASS 表单页签名保持' : 'FAIL 表单页签名被改')

// 4) 名字稳定性总检：所有页签名字在多次切换后不重复、不变
const finalTabs = await page.evaluate(() => [...document.querySelectorAll('.tabsbar .tab span')].map((s) => s.textContent.trim()))
const dup = finalTabs.filter((t, i) => finalTabs.indexOf(t) !== i)
console.log('FINAL TABS ' + JSON.stringify(finalTabs) + (dup.length ? ' DUP=' + JSON.stringify(dup) : ' (无重名)'))
console.log('CONSOLE_ERRORS ' + JSON.stringify(errs.slice(0, 8)))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/tab-title-flip-20261111/round-06.png' })
