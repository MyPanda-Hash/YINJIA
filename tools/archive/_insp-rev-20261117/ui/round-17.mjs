// round-17: 8090 打包版复核红 *(只读,正式账套不保存)
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  }
  await T(400)
} catch (e) { console.log('resize skip: ' + e.message) }

await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(7000)

const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  return {
    factory: txt(document.querySelector('.topbar')).slice(0, 60),
    req: [...(sheet?.querySelectorAll('.ic-req') || [])].map((s) => txt(s.parentElement)),
    reqColor: (() => { const s = sheet?.querySelector('.ic-req'); return s ? getComputedStyle(s).color : '' })(),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: dir + '/shots/round-17-8090-required.png' })
