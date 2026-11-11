// round-02 — 复现用户截图:单行「工序路线排线」里把下方的工序改得比上方小
//   ① 勾 1 行 → 排产 → 弹窗
//   ② 第 1 道完工改 2026-11-13(链上后道开工跟着到 11-13)
//   ③ 第 2 道开工改 2026-11-01  ⇒ 期望:夹回 11-13 + 提示「下道工序的计划开工日期不能早于上道工序的计划完工日期…」
//   全程不点「排产」,不写库。
const OUT = 'D:/workspace/yinjia/tools/archive/_chain-order-guard-20261111/ego-shots'
const task = await taskSpace('chain-order-guard-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/?t=' + Date.now() + '#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(6000)
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(400)

await page.evaluate(() => {
  const t0 = document.querySelectorAll('.el-table')[0]
  const rows = [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])]
  rows[0]?.querySelector('.el-checkbox')?.click()
})
await page.waitForTimeout(1000)
const click = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter((b) => !b.closest('.el-dialog'))
  const btn = btns.find((b) => /^排产$/.test((b.textContent || '').trim()))
  if (btn) btn.click()
  return { found: !!btn, disabled: btn ? btn.disabled : null }
})
console.log('click=' + JSON.stringify(click))

let steps = []
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(500)
  steps = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
    if (!dlg) return []
    if (!(dlg.querySelector('.el-dialog__title')?.textContent || '').includes('工序路线排线')) return []
    const t0 = dlg.querySelector('.el-table')
    return [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])].map((tr) => ({
      op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(),
      vals: [...tr.querySelectorAll('input')].slice(1).map((inp) => inp.value),
    }))
  })
  if (steps.length) break
}
console.log('opened=' + JSON.stringify(steps))
if (!steps.length) process.exit(1)

// ② 第 1 道完工 → 2026-11-13
async function setDate(rowIndex, inputIndex, text) {
  await page.evaluate(([ri, ii]) => {
    const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
    const tr = dlg.querySelectorAll('.el-table__body-wrapper tbody tr')[ri]
    const inputs = [...tr.querySelectorAll('input')]
    inputs[ii].focus()
    inputs[ii].click()
  }, [rowIndex, inputIndex])
  await page.waitForTimeout(500)
  await page.keyboard.press('Control+A')
  await page.keyboard.type(text)
  await page.waitForTimeout(250)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
}

await setDate(0, 2, '2026-11-13')
const afterFirst = await page.evaluate(() => {
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
console.log('afterRow1Due=' + JSON.stringify(afterFirst))

// ③ 第 2 道开工 → 2026-11-01(比上方完工 11-13 小)
await setDate(1, 1, '2026-11-01')
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
console.log('afterRow2Start=' + JSON.stringify(after, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-02-chain-order-clamped.png', fullPage: false })
console.log('shot round-02-chain-order-clamped.png')
