const task = await taskSpace(17)
const page = task.page('p1')
await page.fill('input[placeholder="扫工单码或输入工单号"]', 'GD-2026-09-0135')
await page.click('button:has-text("添加")')
await page.waitForTimeout(2500)
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    added: [...document.querySelectorAll('.mpc-item, .mpc-wo, .mpc-row, [class*="item"]')].map(txt).filter((t) => t.includes('GD-')).slice(0, 8),
    tips: [...document.querySelectorAll('.el-message, .el-notification')].map(txt).slice(0, 4),
    body: txt(document.querySelector('.mp-panel') || document.body).slice(0, 800),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-11-added.png' })
