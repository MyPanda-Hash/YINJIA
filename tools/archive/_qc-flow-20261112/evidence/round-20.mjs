// round-20.mjs — 第二轮终版复核(8090 打包版,缓存穿透):不合格分支 + 隐藏开关 + 节点跳转
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/?v=final2#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const pickState = async (label) => {
  await page.evaluate(() => { const i = document.querySelector('.qcf-sel input'); if (i) i.click() })
  await page.waitForTimeout(600)
  const ok = await page.evaluate((label) => {
    const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((o) => (o.textContent || '').trim() === label)
    if (opt) { opt.click(); return true }
    return false
  }, label)
  await page.waitForTimeout(2500)
  return ok
}

console.log('切 全部 =', await pickState('全部'))
const a = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const ng = rows.filter((r) => r.querySelector('.qcf-lane-ng'))
  return {
    rows: rows.length,
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    ngRows: ng.length,
    ngSample: ng.slice(0, 2).map((r) => [...r.querySelectorAll('.qcf-lane-ng .qcf-node')].map(text)),
    hasSwitch: [...document.querySelectorAll('.qcf-only')].some((c) => (c.textContent || '').includes('显示已隐藏')),
  }
})
console.log('全部(未勾) =', JSON.stringify(a, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-20-8090-ng.png' })

await page.evaluate(() => {
  const c = [...document.querySelectorAll('.qcf-only')].find((x) => (x.textContent || '').includes('显示已隐藏'))
  const i = c && c.querySelector('input')
  if (i) i.click()
})
await page.waitForTimeout(3000)
const b = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const hidden = rows.find((r) => r.querySelector('.qcf-hidden-tag'))
  return {
    rows: rows.length,
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    hiddenBadges: rows.filter((r) => r.querySelector('.qcf-hidden-tag')).length,
    sampleHidden: hidden ? { batch: text(hidden.querySelector('.qcf-batch')), nodes: [...hidden.querySelectorAll('.qcf-node')].map(text), tag: text(hidden.querySelector('.qcf-hidden-tag')) } : null,
  }
})
console.log('全部(勾上) =', JSON.stringify(b, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-20-8090-hidden.png' })

// 点分支里的「暂收退回单」节点(管理员有 QC_RETURN 权限)→ 应跳到该面板
const jumped = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const row = rows.find((r) => r.querySelector('.qcf-lane-ng .qcf-node .qcf-node-no:not(.is-empty)'))
  if (!row) return { err: 'no ng row' }
  const node = row.querySelector('.qcf-lane-ng .qcf-node')
  const no = (node.querySelector('.qcf-node-no') || {}).textContent || ''
  node.click()
  return { no: no.trim() }
})
await page.waitForTimeout(2500)
console.log('点退回节点 =', JSON.stringify({ jumped, hash: await page.evaluate(() => location.hash) }))
console.log('done')
