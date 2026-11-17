const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/panelx/list/RD_PLAN')
await page.waitForTimeout(12000)
const info = await page.evaluate(() => {
  // 左侧单据预览轨里的单号清单
  const railItems = [...document.querySelectorAll('.dsr-item, .dsr-card, [class*="dsr"]')]
    .map(e => (e.innerText||'').replace(/\s+/g,' ').trim()).filter(t => t && t.length < 60).slice(0, 10)
  const statusEl = [...document.querySelectorAll('*')].find(e => /^(草稿|已审核|已归档|审批中|终止审批中)/.test((e.innerText||'').trim()) && (e.innerText||'').trim().length < 20)
  return {
    docStatus: statusEl ? statusEl.innerText.trim() : null,
    railItems,
    phaseContents: [...document.querySelectorAll('.as-phase')].map(p => (p.innerText||'').replace(/\s+/g,' ').slice(0, 60)).slice(0, 3),
    footers: document.querySelectorAll('.as-phase-footer').length,
    termBtns: [...document.querySelectorAll('button')].map(b=>(b.innerText||'').trim()).filter(t=>t.includes('终止')||t.includes('完成')),
  }
})
console.log(JSON.stringify(info, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_plan-term-check-20261117/plan-list.png' })
await task.finish({ keep: [] })
process.exit(0)
