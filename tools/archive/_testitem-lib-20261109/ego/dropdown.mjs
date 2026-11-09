// 「加标水配置记录表」的「测试项目」下拉:服务器 vs 本机,逐项读出(只读,不保存)
const task = await taskSpace('testitem-lib-20261109')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { /* ignore */ }
}

async function readOptions(base, tag) {
  await page.goto(base + '/#/login', { timeout: 40000 })
  await page.waitForTimeout(1200)
  await page.evaluate(async () => {
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
    })
    const j = await r.json()
    localStorage.setItem('mes_token', j.data.token)
    localStorage.setItem('mes_user', JSON.stringify(j.data.user || {}))
    localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))
  })
  await page.goto(base + '/#/panelx/list/RD_SPIKE_WATER', { timeout: 40000 })
  await page.reload({ timeout: 60000 })
  await page.waitForTimeout(10000)
  // 点开「测试项目」下拉
  let opened = false
  for (const sel of ['css:.rsp-proj .el-select', 'css:.rsp-sheet .el-select', 'css:.el-select']) {
    try { await page.click(sel, { timeout: 4000 }); opened = true; break } catch (e) { /* try next */ }
  }
  await page.waitForTimeout(1500)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.textContent || '').trim()))
  await restoreWindow()
  await page.screenshot({ path: `C:/Users/Lenovo/ego/testitem-lib-20261109/${tag}.png` })
  return { opened, opts }
}

const srv = await readOptions('http://36.140.66.163:8090', 'server-dropdown')
console.log('SERVER opened=' + srv.opened + ' opts=' + JSON.stringify(srv.opts))
const loc = await readOptions('http://127.0.0.1:8090', 'local-dropdown')
console.log('LOCAL  opened=' + loc.opened + ' opts=' + JSON.stringify(loc.opts))
const onlySrv = srv.opts.filter((x) => !loc.opts.includes(x))
const onlyLoc = loc.opts.filter((x) => !srv.opts.includes(x))
console.log('仅服务器: ' + JSON.stringify(onlySrv))
console.log('仅本机  : ' + JSON.stringify(onlyLoc))
