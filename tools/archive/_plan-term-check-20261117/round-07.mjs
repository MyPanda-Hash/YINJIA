const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false })

async function formLogin() {
  // 真实表单登录（SPA 内跳转，不触发整页刷新）
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')]
    const u = inputs.find(i => i.type === 'text' || i.type === '')
    const p = inputs.find(i => i.type === 'password')
    if (u) { u.value = 'admin'; u.dispatchEvent(new Event('input', { bubbles: true })) }
    if (p) { p.value = '123456'; p.dispatchEvent(new Event('input', { bubbles: true })) }
  })
  await page.waitForTimeout(600)
  const btn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /登录|进入/.test((x.innerText||'')))
    if (b) { b.click(); return true }
    return false
  })
  return btn
}

await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(4500)
console.log('表单登录(首次):', await formLogin())
await page.waitForTimeout(9000)
console.log('落点:', await page.evaluate(() => location.hash))

await page.evaluate(() => { location.hash = '#/panelx/list/RD_PLAN' })
await page.waitForTimeout(6000)
await page.evaluate(() => { location.hash = '#/panelx/list/RD_PROD_INFO' })
await page.waitForTimeout(6000)
const tabs = () => page.evaluate(() =>
  [...document.querySelectorAll('.tab')].map(e => (e.innerText||'').replace(/\s+/g,' ').trim()).filter(Boolean))
console.log('登出前页签:', JSON.stringify(await tabs()))

// 真实登出
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
console.log('登出后:', JSON.stringify(await page.evaluate(() => ({ hash: location.hash }))))

// SPA 内再次表单登录（关键：不 reload）
console.log('表单登录(切换后):', await formLogin())
await page.waitForTimeout(9000)
const after = await tabs()
const info = await page.evaluate(() => ({ hash: location.hash, bodyHasPlan: document.body.innerText.includes('项目实施计划'), bodyHasProd: document.body.innerText.includes('产品信息表') }))
console.log('切换账号后页签:', JSON.stringify(after))
console.log('切换账号后落点:', JSON.stringify(info))
await task.finish({ keep: [] })
process.exit(0)
