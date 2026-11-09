// 加标水配置记录表:本机(8090)vs 服务器(36.140.66.163:8090)——把纸面表头逐列读出来对比
// 只读:登录 + 打开面板 + 选「测试项目 = NSF 53-除汞（PH8.5)」,不保存任何单据。
const task = await taskSpace('spike-water-cols-20261109')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/spike-water-cols-20261109'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { /* ignore */ }
}

async function openAndRead(base, tag) {
  await page.goto(base + '/#/login', { timeout: 40000 })
  await page.waitForTimeout(1500)
  const ok = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
      })
      const j = await r.json()
      if (!j?.data?.token) return false
      localStorage.setItem('mes_token', j.data.token)
      localStorage.setItem('mes_user', JSON.stringify(j.data.user || {}))
      localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))
      return true
    } catch (e) { return false }
  })
  await page.goto(base + '/#/panelx/list/RD_SPIKE_WATER', { timeout: 40000 })
  await page.reload({ timeout: 60000 })
  await page.waitForTimeout(9000)
  // 选测试项目=除汞
  try {
    await page.click('css:.rsp-sheet .el-select', { timeout: 6000 })
    await page.waitForTimeout(1200)
    const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.textContent || '').trim()))
    const i = opts.findIndex((t) => t.includes('除汞'))
    if (i >= 0) { await page.click(`css:.el-select-dropdown__item >> nth=${i}`); await page.waitForTimeout(2500) }
  } catch (e) { console.log(tag + ' pick skip: ' + e.message) }
  const res = await page.evaluate(() => {
    const ths = [...document.querySelectorAll('table th')]
    const heads = ths.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    return { project: (document.querySelector('.rsp-sheet .el-select input')?.value || '').trim(), heads }
  })
  await restoreWindow()
  await page.screenshot({ path: `${OUT}/${tag}.png` })
  return { ok, ...res }
}

const loc = await openAndRead('http://127.0.0.1:8090', 'local-8090')
console.log('LOCAL  ' + JSON.stringify(loc))
const srv = await openAndRead('http://36.140.66.163:8090', 'server-prod')
console.log('SERVER ' + JSON.stringify(srv))

const L = loc.heads
const S = srv.heads
const onlySrv = S.filter((x) => !L.includes(x))
const onlyLoc = L.filter((x) => !S.includes(x))
console.log('=== 差异 ===')
console.log('仅服务器: ' + JSON.stringify(onlySrv))
console.log('仅本机  : ' + JSON.stringify(onlyLoc))
