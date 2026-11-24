const task = await taskSpace(33)
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
// 先关掉可能残留的浮层
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await page.goto('http://localhost:5173/#/panelx/list/RD_SAMPLE_EXT')
await page.waitForSelector('.panelx-list', { timeout: 25000 })
await page.waitForTimeout(1000)
const info = await page.evaluate(() => {
  const lists = [...document.querySelectorAll('.panelx-list')]
  const vis = lists.filter((x) => x.offsetParent !== null)
  const root = vis[0] || lists[0]
  const btns = [...root.querySelectorAll('.as-side-btn')].map((b) => b.textContent.trim())
  const b = [...root.querySelectorAll('.as-side-btn')].find((x) => x.textContent.trim() === '单据预览')
  if (b) b.click()
  return { lists: lists.length, visibleLists: vis.length, btns }
})
console.log('scope:', JSON.stringify(info))
await page.waitForFunction(() => document.querySelectorAll('.apv-panel').length === 1, undefined, { timeout: 10000 })
const first = await page.evaluate(() => {
  const tr = document.querySelector('.apv-table .el-table__body tr')
  const cells = tr ? [...tr.querySelectorAll('td .cell')].map((e) => e.textContent.trim()) : []
  return { cells }
})
console.log('first row:', JSON.stringify(first))
// 用「跳转」按钮跳（操作列）
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.apv-table .el-button')].find((b) => b.textContent.trim() === '跳转')
  if (btn) btn.click()
  return !!btn
})
console.log('clicked 跳转:', clicked)
await page.waitForFunction(() => !document.querySelector('.apv-panel'), undefined, { timeout: 10000 })
await page.waitForTimeout(2500)
const after = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')].filter((i) => i.offsetParent !== null).map((i) => i.value).filter(Boolean).slice(0, 25)
  const text = document.body.innerText.replace(/\s+/g, ' ')
  const idx = text.indexOf('单据编号')
  return {
    url: location.href,
    inputs,
    aroundDocNo: idx >= 0 ? text.slice(idx, idx + 60) : '',
    hasTarget: text.includes('SPW-2026-11-0011'),
  }
})
console.log('after jump:', JSON.stringify(after, null, 1))
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-rd-fullpreview-20261120/r04-jump-sample-ext.png' })
