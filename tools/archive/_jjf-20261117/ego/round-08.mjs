const task = await taskSpace('jjf-twolevel-20261117')
const page = await task.newPage()
// 8090 = jar 内 static(打包版),用同一个测试账套会话?不同端口是不同 origin/localStorage,需重新登录
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 30000 })
await page.waitForTimeout(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1050 } })
} catch (e) {}
const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
if (need) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  // 选测试库
  await page.evaluate(() => {
    const sel = document.querySelector('.el-select')
    const inner = sel && (sel.querySelector('.el-select__wrapper, .el-input__inner') || sel)
    inner && inner.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('.el-select-dropdown__item')].find((i) => (i.textContent || '').includes('测试'))
    t && t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
}
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_JJF?docNo=JJF-2026-11-0005', { timeout: 30000 })
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.waitForTimeout(600)
const info = await page.evaluate(() => {
  const sheet = document.querySelector('.approval-sheet') || document.body
  return {
    hash: location.hash,
    info: [...document.querySelectorAll('.as-info-row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()),
    rows: [...sheet.querySelectorAll('.q-section-title, .q-dept-name, .q-label')].map((e) => (e.textContent || '').trim()).slice(0, 12),
    hasTestResult: (sheet.textContent || '').includes('检测结果'),
    foot: [...sheet.querySelectorAll('div')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => /^(编制|审核|批准)：/.test(t)).slice(0, 1),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/jjf-twolevel-20261117/r08-8090.png' })
console.log('done')
