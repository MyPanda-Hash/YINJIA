// round-09 — 单行「工序路线排线」弹窗同一套日期链验证(2026-11-09 改造点):
//   打开 1 行 → 把第 1 道「计划完工日期」改到早于「计划开工日期」→ 期望同样的提示 + 开工自动下调;不提交。
const OUT = 'D:/workspace/yinjia/tools/archive/_plandate-guard-20261109/ego-shots'
const task = await taskSpace('plandate-guard-20261109')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/?t=' + Date.now() + '#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(6000)
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(500)

const picked = await page.evaluate(() => {
  const t0 = document.querySelectorAll('.el-table')[0]
  const rows = [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])]
  rows[0]?.querySelector('.el-checkbox')?.click()
  return { poolRows: rows.length }
})
console.log('picked=' + JSON.stringify(picked))
await page.waitForTimeout(1200)

const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter((b) => !b.closest('.el-dialog'))
  const btn = btns.find((b) => /^排产$/.test((b.textContent || '').trim()))
  if (!btn) return { found: false, labels: btns.map((b) => (b.textContent || '').trim()).filter(Boolean) }
  btn.click()
  return { found: true, disabled: btn.disabled }
})
console.log('click=' + JSON.stringify(clicked))

let steps = []
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(500)
  steps = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
    if (!dlg) return []
    const title = (dlg.querySelector('.el-dialog__title')?.textContent || '').trim()
    if (!title.includes('工序路线排线')) return []
    const t0 = dlg.querySelector('.el-table')
    return [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])].map((tr) => ({
      op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(),
      vals: [...tr.querySelectorAll('input')].slice(1).map((inp) => inp.value),
    }))
  })
  if (steps.length) break
}
console.log('steps=' + JSON.stringify(steps))
if (!steps.length) {
  console.log('debug=' + JSON.stringify(await page.evaluate(() => ({ msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()) }))))
  process.exit(1)
}

// 第 1 道的「计划完工日期」
const focus = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
  const tr = dlg.querySelectorAll('.el-table__body-wrapper tbody tr')[0]
  const inputs = [...tr.querySelectorAll('input')]
  const due = inputs[inputs.length - 1]
  due.focus()
  due.click()
  return { count: inputs.length, start: inputs[inputs.length - 2].value, due: due.value }
})
console.log('focus=' + JSON.stringify(focus))
await page.waitForTimeout(600)
await page.keyboard.press('Control+A')
await page.keyboard.type('2026-10-01')
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
await page.screenshot({ path: OUT + '/round-09-single-route-dialog.png', fullPage: false })
console.log('shot round-09-single-route-dialog.png')
