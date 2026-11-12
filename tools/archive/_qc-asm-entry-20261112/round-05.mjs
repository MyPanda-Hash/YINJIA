// round-05 — 8090 打包版 + en:确认新列头(Creatable 等)在发布会用的 static 里也生效
const out = 'C:/Users/vigna/ego/qc-asm-entry-20261112'
const task = await taskSpace('qc-asm-entry-20261112')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_ASM_INSP', { timeout: 30000 })
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload()
await page.waitForTimeout(7000)
const opened = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')]
    .find((e) => /Select work order|Pick production work order/i.test((e.textContent || '')))
  if (btn) btn.click()
  return !!btn
})
await page.waitForSelector('.wopick-tip', { timeout: 15000 })
await page.waitForTimeout(1200)
const state = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
  return {
    opened: true,
    hash: location.hash,
    headers: [...d.querySelectorAll('.el-table__header-wrapper th')].map((x) => (x.textContent || '').trim()).filter(Boolean),
    footerBtns: [...d.querySelectorAll('.el-dialog__footer button')].map((b) => (b.textContent || '').trim()),
  }
})
console.log('P8090_EN=' + JSON.stringify(state))
await page.screenshot({ path: out + '/round-05-8090-en.png' })
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
console.log('done opened=' + opened)
