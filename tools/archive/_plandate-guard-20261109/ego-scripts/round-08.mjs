// round-08 — 干净一轮:重新加载页面 → 勾 2 行 → 批量排产 → 等弹窗数据 → 把第 1 道开工改到 2026-12-01
// 期望:提示「…已自动把完工日期调为 2026-12-01」,完工日推到开工日,链上后续道跟着后移;不提交。
const OUT = 'D:/workspace/yinjia/tools/archive/_plandate-guard-20261109/ego-shots'
const task = await taskSpace('plandate-guard-20261109')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/?t=' + Date.now() + '#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(6000)
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(400)

const picked = await page.evaluate(() => {
  const t0 = document.querySelectorAll('.el-table')[0]
  const rows = [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])]
  const clicked = []
  for (let i = 0; i < Math.min(2, rows.length); i++) {
    const cb = rows[i].querySelector('.el-checkbox')
    if (cb) { cb.click(); clicked.push(i) }
  }
  const btn = [...document.querySelectorAll('button')].find((b) => /批量排产|^排产$/.test((b.textContent || '').trim()))
  return { poolRows: rows.length, clicked, btnText: btn ? btn.textContent.trim() : null, btnDisabled: btn ? btn.disabled : null }
})
console.log('picked=' + JSON.stringify(picked))
await page.waitForTimeout(800)

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('批量排产'))
  if (btn) btn.click()
})
// 轮询等弹窗里的工序行出来(最多 10s)
let steps = []
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(500)
  steps = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
    if (!dlg) return []
    const t0 = dlg.querySelector('.el-table')
    if (!t0) return []
    return [...t0.querySelectorAll('.el-table__body-wrapper tbody tr')].map((tr) => ({
      op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(),
      vals: [...tr.querySelectorAll('input')].slice(1).map((inp) => inp.value),
    }))
  })
  if (steps.length) break
}
console.log('steps=' + JSON.stringify(steps))
if (!steps.length) {
  const dbg = await page.evaluate(() => ({
    msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
    dialogText: ([...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()?.innerText || '').slice(0, 600),
  }))
  console.log('debug=' + JSON.stringify(dbg))
  process.exit(1)
}

const focus = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  const tr = dlg.querySelectorAll('.el-table__body-wrapper tbody tr')[0]
  const inputs = [...tr.querySelectorAll('input')]
  inputs[1].focus()
  inputs[1].click()
  return { start: inputs[1].value, due: inputs[2].value }
})
console.log('focus=' + JSON.stringify(focus))
await page.waitForTimeout(600)
await page.keyboard.press('Control+A')
await page.keyboard.type('2026-12-01')
await page.waitForTimeout(300)
await page.keyboard.press('Enter')
await page.waitForTimeout(1200)

const after = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  const t0 = dlg.querySelector('.el-table')
  return {
    rows: [...t0.querySelectorAll('.el-table__body-wrapper tbody tr')].map((tr) => ({
      op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(),
      vals: [...tr.querySelectorAll('input')].slice(1).map((inp) => inp.value),
    })),
    msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log('after=' + JSON.stringify(after, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-08-start-later-than-due.png', fullPage: false })
console.log('shot round-08-start-later-than-due.png')
