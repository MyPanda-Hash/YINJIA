/**
 * round-03:先清浏览器 HTTP 缓存(8091 用 dist 提供服务,旧 index.html 缓存指向已删除的 chunk ⇒ 404 白屏),
 * 再进「来料品质流程监控」取证据。
 */
const OUT = 'C:/Users/vigna/ego/qc-flow-rec-20261120'
const task = await taskSpace('qc-flow-rec-20261120')
const page = task.page('p1')

try { await page.cdp('Network.clearBrowserCache', {}) } catch (e) { console.log('clearCache skip: ' + e.message) }

await page.goto('http://127.0.0.1:8091/?_r=' + Date.now(), { timeout: 40000 })
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1500)
  const st = await page.evaluate(() => ({
    boot: !!document.getElementById('boot-tip'),
    fatal: document.getElementById('boot-fatal')?.textContent?.slice(0, 240) || '',
    body: document.body.innerText.slice(0, 160),
  }))
  console.log('wait', i, JSON.stringify(st))
  if (!st.boot || st.fatal) break
}

const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
console.log('needLogin =', needLogin)
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
  await page.waitForTimeout(8000)
  console.log('after login hash =', await page.evaluate(() => location.hash))
}

await page.goto('http://127.0.0.1:8091/#/qc/flowMonitor', { timeout: 40000 })
try { await page.waitForSelector('.qcf-page', { timeout: 30000 }) } catch (e) { console.log('no .qcf-page: ' + e.message) }
await page.waitForTimeout(3000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const dump = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qcf-grid-row')]
  const laneOf = (row) => [...row.querySelectorAll('.qcf-slot')].map((slot) => ({
    n: slot.querySelectorAll('.qcf-node, .qcf-skip-chip').length,
    nodes: [...slot.querySelectorAll('.qcf-node, .qcf-skip-chip')].map((n) => ({
      name: n.querySelector('.qcf-node-name')?.textContent?.trim() || n.textContent?.trim(),
      no: n.querySelector('.qcf-node-no')?.textContent?.trim() || '',
      badge: n.querySelector('.qcf-badge')?.textContent?.trim() || '',
      date: n.querySelector('.qcf-node-meta i')?.textContent?.trim() || '',
    })),
  }))
  return {
    title: document.querySelector('.qcf-title')?.textContent?.trim() || '',
    hash: location.hash,
    stats: [...document.querySelectorAll('.qcf-stat')].map((s) => s.textContent.replace(/\s+/g, ' ').trim()),
    rowCount: rows.length,
    firstRows: rows.slice(0, 3).map((r) => ({
      batch: r.querySelector('.qcf-batch')?.textContent?.trim(),
      code: r.querySelector('.qcf-code')?.textContent?.trim(),
      stage: r.querySelector('.qcf-stage-tag')?.textContent?.trim(),
      lane: laneOf(r),
    })),
    recNodeCount: [...document.querySelectorAll('.qcf-node')].filter((n) => (n.textContent || '').includes('检验数据记录')).length,
    recWithNo: [...document.querySelectorAll('.qcf-node')]
      .filter((n) => (n.textContent || '').includes('检验数据记录'))
      .filter((n) => n.querySelector('.qcf-node-no') && !n.querySelector('.qcf-node-no.is-empty')).length,
  }
})
console.log(JSON.stringify(dump, null, 2))
await page.screenshot({ path: OUT + '/03-flow-monitor.png' })
console.log('screenshot ->', OUT + '/03-flow-monitor.png')
