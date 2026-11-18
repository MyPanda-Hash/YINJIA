const task = await taskSpace('qc-docs-20261118')
const page = task.page('p1')
try { await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false }) } catch (e) {}
await page.goto('http://localhost:5173/#/panelx/list/QC_TC_IN?docNo=TCI-2026-11-0001', { timeout: 30000 })
await page.waitForTimeout(6000)
const d = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('.q-date-in')]
  return {
    count: ins.length,
    boxes: ins.slice(0, 12).map((el) => {
      const input = el.querySelector('input')
      return {
        cls: (el.className || '').replace(/el-input(\S*)/g, '').trim(),
        w: Math.round(el.getBoundingClientRect().width),
        val: input ? input.value : '',
        shown: input ? Math.round(input.getBoundingClientRect().width) : 0,
      }
    }),
    signDates: [...document.querySelectorAll('.q-sign-date')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 6),
  }
})
console.log(JSON.stringify(d, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r06-tcin-draft.png' })
