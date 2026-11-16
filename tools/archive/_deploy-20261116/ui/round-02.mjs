// round-02:检验委托单纸面三行合并(委托单位/单位地址、制造商/地址、生产厂/地址)
const task = await taskSpace('deploy-20261116-verify')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(6000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

// 列表页现状(有几张单 / 有没有 500)
const listState = await page.evaluate(() => {
  const txt = document.body.innerText || ''
  return {
    hash: location.hash,
    hasError: /500|错误|异常/.test(txt.slice(0, 4000)) && /接口|服务/.test(txt),
    listRows: [...document.querySelectorAll('.el-table__body tr')].length,
    hasNewBtn: [...document.querySelectorAll('button')].some((b) => /新建|新增/.test(b.textContent || '')),
  }
})
console.log('列表页:', JSON.stringify(listState))

// 点「新建」看纸面(不保存)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /新建|新增/.test((b.textContent || '').trim()))
  if (btn) btn.click()
})
await page.waitForTimeout(6000)

const sheet = await page.evaluate(() => {
  const el = document.querySelector('.ic-sheet')
  if (!el) return { found: false, bodyStart: (document.body.innerText || '').slice(0, 300) }
  const lines = [...el.querySelectorAll('.ic-party-line')].map((n) => ({
    labels: [...n.closest('tr').querySelectorAll('th')].map((t) => (t.textContent || '').trim()),
    inputs: n.querySelectorAll('input').length,
    texts: n.querySelectorAll('.ic-text').length,
  }))
  return {
    found: true,
    partyRows: lines,
    pickBtnNoPrint: [...el.querySelectorAll('.ic-pick-btn')].map((b) => b.className),
    sheetWidth: Math.round(el.getBoundingClientRect().width),
  }
})
console.log('纸面:', JSON.stringify(sheet, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/deploy-20261116/round-02-insp-sheet.png' })
