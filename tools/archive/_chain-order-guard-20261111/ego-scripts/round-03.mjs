// round-03 — 另外两条路径同一把尺:
//   ① 单行弹窗:改**下方工序的完工**到早于上方完工 ⇒ 夹回并提示(key: 下道工序的计划完工日期不能早于…)
//   ② 批量排产弹窗:改**下方工序的开工**到早于上方完工 ⇒ 同样夹回
// 全程不点提交。
const OUT = 'D:/workspace/yinjia/tools/archive/_chain-order-guard-20261111/ego-shots'
const task = await taskSpace('chain-order-guard-20261111')
const page = task.page('p1')

async function dumpDialog(titleKeyword) {
  return page.evaluate((kw) => {
    const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
    if (!dlg) return { title: null, rows: [], msgs: [] }
    const t0 = dlg.querySelector('.el-table')
    return {
      title: (dlg.querySelector('.el-dialog__title')?.textContent || '').trim(),
      rows: [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])].map((tr) => ({
        op: (tr.querySelectorAll('td')[1]?.innerText || '').trim(),
        vals: [...tr.querySelectorAll('input')].slice(1).map((inp) => inp.value),
      })),
      msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t.includes(kw)),
    }
  }, titleKeyword)
}

async function setDate(scope, rowIndex, inputIndex, text) {
  await page.evaluate(([sc, ri, ii]) => {
    const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).pop()
    const tr = dlg.querySelectorAll('.el-table__body-wrapper tbody tr')[ri]
    const inputs = [...tr.querySelectorAll('input')]
    inputs[ii].focus()
    inputs[ii].click()
  }, [scope, rowIndex, inputIndex])
  await page.waitForTimeout(500)
  await page.keyboard.press('Control+A')
  await page.keyboard.type(text)
  await page.waitForTimeout(250)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
}

// ── ① 单行弹窗:改下方完工 ──
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
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter((b) => !b.closest('.el-dialog'))
  btns.find((b) => /^排产$/.test((b.textContent || '').trim()))?.click()
})
for (let i = 0; i < 20; i++) { await page.waitForTimeout(500); if ((await dumpDialog('工序路线排线')).rows.length) break }
await setDate('single', 0, 2, '2026-11-13')          // 上方完工 11-13(链带下道开工)
await setDate('single', 1, 2, '2026-11-01')          // 下方完工改到 11-01
const singleDue = await dumpDialog('下道工序')
console.log('singleDueClamp=' + JSON.stringify(singleDue, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-03a-single-due-clamped.png', fullPage: false })
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(800)

// ── ② 批量排产弹窗:改下方开工 ──
await page.evaluate(() => {
  const t0 = document.querySelectorAll('.el-table')[0]
  const rows = [...(t0?.querySelectorAll('.el-table__body-wrapper tbody tr') || [])]
  rows[0]?.querySelector('.el-checkbox')?.click()
  rows[1]?.querySelector('.el-checkbox')?.click()
})
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('批量排产'))
  if (btn) btn.click()
})
for (let i = 0; i < 20; i++) { await page.waitForTimeout(500); if ((await dumpDialog('批量')).rows.length) break }
await setDate('batch', 0, 2, '2026-11-13')
await setDate('batch', 1, 1, '2026-11-01')
const batchStart = await dumpDialog('下道工序')
console.log('batchStartClamp=' + JSON.stringify(batchStart, null, 2))
await page.screenshot({ path: OUT + '/round-03b-batch-start-clamped.png', fullPage: false })
console.log('shots round-03a/b done')
await page.keyboard.press('Escape').catch(() => {})
