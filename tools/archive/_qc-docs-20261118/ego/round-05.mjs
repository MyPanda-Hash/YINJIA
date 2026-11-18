const task = await taskSpace('qc-docs-20261118')
const page = task.page('p1')
try { await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false }) } catch (e) {}
await page.goto('http://localhost:5173/#/panelx/list/QC_TC_IN', { timeout: 30000 })
await page.waitForTimeout(5500)
const d = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('.q-date-in')]
  return {
    count: ins.length,
    boxes: ins.slice(0, 9).map((el) => ({
      cls: el.className.replace(/el-input[^ ]*/g, '').trim(),
      w: Math.round(el.getBoundingClientRect().width),
      val: (el.querySelector('input') || {}).value || '',
    })),
    signDates: [...document.querySelectorAll('.q-sign-date')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 4),
  }
})
console.log(JSON.stringify(d, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r05-tcin-dates.png' })
