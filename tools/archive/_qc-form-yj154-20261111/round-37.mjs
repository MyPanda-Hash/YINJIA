// round-37:弹窗关闭行为核查(取消 / ESC / × 三种方式),并确认页面最终状态干净
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')

const dlgState = () => page.evaluate(() => {
  const overlays = [...document.querySelectorAll('.el-overlay')]
  return {
    overlays: overlays.map((o) => ({ display: getComputedStyle(o).display, visible: o.offsetParent !== null, h: Math.round(o.getBoundingClientRect().height) })),
    dialogs: [...document.querySelectorAll('.el-dialog')].map((d) => ({ display: getComputedStyle(d).display, w: Math.round(d.getBoundingClientRect().width) })),
  }
})

await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(6000)
await page.evaluate(() => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === '未完成')?.click())
await page.waitForTimeout(2500)
await page.evaluate(() => document.querySelectorAll('.dsr-grid tbody tr')[0]?.click())
await page.waitForTimeout(2800)
await page.evaluate(() => document.querySelector('.qr-label .qr-opt-mgr')?.click())
await page.waitForTimeout(1200)
console.log('OPEN=' + JSON.stringify(await dlgState()))
await page.evaluate(() => { const b = [...document.querySelectorAll('.el-dialog__footer button')].find((x) => (x.textContent || '').includes('取消')); b?.click() })
await page.waitForTimeout(2000)
console.log('AFTER_CANCEL=' + JSON.stringify(await dlgState()))
// 再开一次,用 × 关
await page.evaluate(() => document.querySelector('.qr-label .qr-opt-mgr')?.click())
await page.waitForTimeout(1200)
await page.evaluate(() => { document.querySelector('.el-dialog__headerbtn')?.click() })
await page.waitForTimeout(2000)
console.log('AFTER_X=' + JSON.stringify(await dlgState()))
