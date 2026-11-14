// round-18.mjs — 验证「显示已隐藏」开关:在 全部 视图下勾上应出现已转ERP 的行并可点开
const task = await taskSpace('qc-flow-monitor-20261112')
const page = task.page('p1')
await page.goto('http://localhost:5173/?v=ng5#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const pickState = async (label) => {
  await page.evaluate((label) => {
    const wrap = document.querySelector('.qcf-sel')
    const inp = wrap && wrap.querySelector('input')
    if (inp) inp.click()
  }, label)
  await page.waitForTimeout(600)
  const ok = await page.evaluate((label) => {
    const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((o) => (o.textContent || '').trim() === label)
    if (opt) { opt.click(); return true }
    return false
  }, label)
  await page.waitForTimeout(2200)
  return ok
}

console.log('切到 全部 =', await pickState('全部'))
let snap = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    rows: document.querySelectorAll('.qcf-grid-row').length,
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    hiddenBadges: document.querySelectorAll('.qcf-hidden-tag').length,
    switchOn: (() => { const c = [...document.querySelectorAll('.qcf-only')].find((x) => (x.textContent || '').includes('显示已隐藏')); const i = c && c.querySelector('input'); return i ? i.checked : null })(),
  }
})
console.log('全部/未勾 =', JSON.stringify(snap))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-18-all-nohidden.png' })

await page.evaluate(() => {
  const c = [...document.querySelectorAll('.qcf-only')].find((x) => (x.textContent || '').includes('显示已隐藏'))
  const i = c && c.querySelector('input')
  if (i) i.click()
})
await page.waitForTimeout(3000)
snap = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const firstHidden = rows.find((r) => r.querySelector('.qcf-hidden-tag'))
  return {
    rows: rows.length,
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    hiddenBadges: rows.filter((r) => r.querySelector('.qcf-hidden-tag')).length,
    switchOn: (() => { const c = [...document.querySelectorAll('.qcf-only')].find((x) => (x.textContent || '').includes('显示已隐藏')); const i = c && c.querySelector('input'); return i ? i.checked : null })(),
    sample: firstHidden ? {
      batch: text(firstHidden.querySelector('.qcf-batch')),
      nodes: [...firstHidden.querySelectorAll('.qcf-node')].map(text),
      tag: text(firstHidden.querySelector('.qcf-hidden-tag')),
      stage: text(firstHidden.querySelector('.qcf-stage-tag')),
    } : null,
  }
})
console.log('全部/勾上 =', JSON.stringify(snap, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-18-all-hidden.png' })

// 点一个已隐藏行的入库节点 → 仍应能打开那张单
const clicked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const row = rows.find((r) => r.querySelector('.qcf-hidden-tag'))
  if (!row) return { err: 'no hidden row' }
  const nodes = [...row.querySelectorAll('.qcf-node')]
  const inNode = nodes.find((n) => (n.textContent || '').includes('采购入库单'))
  if (!inNode) return { err: 'no in node' }
  const no = (inNode.querySelector('.qcf-node-no') || {}).textContent || ''
  inNode.click()
  return { no: no.trim() }
})
await page.waitForTimeout(2500)
const after = await page.evaluate(() => ({ hash: location.hash }))
console.log('点已隐藏行的入库节点 =', JSON.stringify({ clicked, after }))
