// round-01.mjs — 品质流程监控 首轮实测(vite 5173):进入页面、汇总、三节点、截图
const task = await taskSpace('qc-flow-monitor-20261112')
console.log('spaceId=' + task.spaceId)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/qc/flowMonitor', { timeout: 60000 })
await page.waitForTimeout(3500)

// 登录页兜底:自动登录后回到本页
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  await page.goto('http://localhost:5173/#/qc/flowMonitor', { timeout: 60000 })
  await page.waitForTimeout(3500)
}

// 截图前恢复窗口(最小化会截不到)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  }
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const info = await page.evaluate(() => {
  const text = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.qcf-grid-row')].slice(0, 4).map((r) => ({
    batch: text(r.querySelector('.qcf-batch')),
    name: text(r.querySelector('.qcf-prod')),
    kv: [...r.querySelectorAll('.qcf-kv')].map(text),
    nodes: [...r.querySelectorAll('.qcf-node')].map((n) => ({
      name: text(n.querySelector('.qcf-node-name')),
      no: text(n.querySelector('.qcf-node-no')),
      badge: text(n.querySelector('.qcf-badge')),
      date: text(n.querySelector('.qcf-node-meta i')),
      qty: text(n.querySelector('.qcf-node-qty')),
      locked: !!n.querySelector('.qcf-lock'),
      cls: n.className,
    })),
    stage: text(r.querySelector('.qcf-stage-tag')),
    days: text(r.querySelector('.qcf-days')),
  }))
  return {
    hash: location.hash,
    title: text(document.querySelector('.qcf-title')),
    stats: [...document.querySelectorAll('.qcf-stat')].map(text),
    head: [...document.querySelectorAll('.qcf-grid-head span')].map(text),
    rowCount: document.querySelectorAll('.qcf-grid-row').length,
    rows,
    menuHasEntry: document.body.innerText.includes('品质流程监控'),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-flow-monitor-20261112/round-01-board.png' })
console.log('shot ok')
