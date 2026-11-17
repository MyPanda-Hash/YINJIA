const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false })

/** 真实表单登录：账号下拉选 admin + 密码 + 点「进入系统」，全程 SPA 内不刷新 */
async function formLogin() {
  // 打开账号下拉
  await page.evaluate(() => {
    const sel = document.querySelector('.el-select')
    sel?.querySelector('.el-select__wrapper, .el-input__wrapper')?.click?.()
    sel?.click?.()
  })
  await page.waitForTimeout(1000)
  const picked = await page.evaluate(() => {
    const opt = [...document.querySelectorAll('.el-select-dropdown__item, li')].find(e => (e.innerText||'').trim() === 'admin')
    if (opt) { opt.click(); return true }
    return false
  })
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    const p = document.querySelector('input[type=password]')
    if (p) { p.value = '123456'; p.dispatchEvent(new Event('input', { bubbles: true })) }
  })
  await page.waitForTimeout(400)
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /进入系统/.test(x.innerText||''))
    if (b) { b.click(); return true }
    return false
  })
  return { picked, clicked }
}

await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(5000)
console.log('首次登录:', JSON.stringify(await formLogin()))
await page.waitForTimeout(9000)
console.log('落点:', await page.evaluate(() => location.hash))

await page.evaluate(() => { location.hash = '#/panelx/list/RD_PLAN' })
await page.waitForTimeout(6000)
await page.evaluate(() => { location.hash = '#/panelx/list/RD_PROD_INFO' })
await page.waitForTimeout(6000)
const tabs = () => page.evaluate(() => [...document.querySelectorAll('.tab')].map(e => (e.innerText||'').replace(/\s+/g,' ').trim()).filter(Boolean))
console.log('登出前页签:', JSON.stringify(await tabs()))

await page.evaluate(() => {
  const t = [...document.querySelectorAll('*')].find(e => (e.innerText||'').trim() === 'admin' && e.getBoundingClientRect().width > 0)
  t?.click()
})
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('*')].find(e => (e.innerText||'').trim() === '退出')
  it?.click()
})
await page.waitForTimeout(3500)
console.log('登出后 hash:', await page.evaluate(() => location.hash))

console.log('切换后登录:', JSON.stringify(await formLogin()))
await page.waitForTimeout(10000)
const after = await tabs()
const info = await page.evaluate(() => ({
  hash: location.hash,
  hasPlanTab: document.body.innerText.includes('项目实施计划'),
  hasProdTab: document.body.innerText.includes('产品信息表'),
}))
console.log('切换账号后页签:', JSON.stringify(after))
console.log('切换账号后:', JSON.stringify(info))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_plan-term-check-20261117/after-switch.png' })
await task.finish({ keep: [] })
process.exit(0)
