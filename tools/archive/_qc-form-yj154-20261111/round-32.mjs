// round-32:UI 验证「⚙ 维护处理意见选项」弹窗(不保存,避免动正式库选项库)
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')

const state = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const gear = document.querySelector('.qr-label .qr-opt-mgr')
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
  return {
    gear: gear ? { title: gear.getAttribute('title'), text: (gear.textContent || '').trim() } : null,
    dialogOpen: !!dlg,
    dialogTitle: dlg ? ((dlg.querySelector('.el-dialog__title')?.textContent) || '').trim() : null,
    hint: dlg ? ((dlg.querySelector('.qr-opt-hint')?.textContent) || '').trim().slice(0, 40) : null,
    rows: dlg ? [...dlg.querySelectorAll('.qr-opt-row input')].map((i) => i.value) : [],
    addText: dlg ? ((dlg.querySelector('.qr-opt-add')?.textContent) || '').trim() : null,
    buttons: dlg ? [...dlg.querySelectorAll('.el-dialog__footer button')].map((b) => (b.textContent || '').trim()) : [],
    disposalOptions: (() => {
      const th = [...document.querySelectorAll('.qr-foot-table th')].find((x) => (x.textContent || '').includes('处理意见'))
      const w = th?.nextElementSibling?.querySelector('.el-select__wrapper')
      if (!w) return null
      w.click()
      return 'clicked'
    })(),
  }
})

await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(6500)
await page.evaluate(() => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === '未完成')?.click())
await page.waitForTimeout(2500)
await page.evaluate(() => document.querySelectorAll('.dsr-grid tbody tr')[0]?.click())
await page.waitForTimeout(3000)
console.log('BASE=' + JSON.stringify({ gear: (await state()).gear }))
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown')].filter((l) => l.offsetParent !== null).map((l) => [...l.querySelectorAll('.el-select-dropdown__item')].map((li) => (li.textContent || '').trim())))
console.log('DROP_OPTS=' + JSON.stringify(opts))
const opened = await page.evaluate(() => {
  const g = document.querySelector('.qr-label .qr-opt-mgr')
  if (!g) return false
  g.click()
  return true
})
await page.waitForTimeout(1200)
console.log('OPEN=' + opened + ' DLG=' + JSON.stringify(await state()))
const added = await page.evaluate(() => { const a = document.querySelector('.el-dialog .qr-opt-add'); if (!a) return false; a.click(); return true })
await page.waitForTimeout(800)
const st2 = await state()
console.log('ADD_ROW=' + JSON.stringify({ added, rows: st2.rows }))
const removed = await page.evaluate(() => { const x = document.querySelectorAll('.el-dialog .qr-opt-del'); if (!x.length) return false; x[x.length - 1].click(); return true })
await page.waitForTimeout(800)
console.log('REMOVE_ROW=' + JSON.stringify({ removed, rows: (await state()).rows }))
await page.evaluate(() => { const b = [...document.querySelectorAll('.el-dialog__footer button')].find((x) => (x.textContent || '').includes('取消')); b?.click() })
await page.waitForTimeout(800)
console.log('CLOSED=' + JSON.stringify({ open: (await state()).dialogOpen }))
