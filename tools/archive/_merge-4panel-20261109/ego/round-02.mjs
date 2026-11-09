const task = await taskSpace('merge-4panel-20261109')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/merge-4panel-20261109'
const base = 'http://127.0.0.1:8090'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) {
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    }
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await restoreWindow()
await page.goto(base + '/#/login', { timeout: 30000 })
await page.waitForTimeout(1200)
const ok = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const j = await r.json()
  if (!j?.data?.token) return { err: j }
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user || {}))
  localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))
  return { ok: true }
})
console.log('login=' + JSON.stringify(ok))

for (const [code, name] of [['RD_EQUIP_USE', '设备使用登记表'], ['RD_SPIKE_WATER', '加标水配置记录表'], ['RD_DOM_TEST', '测试申请单'], ['RD_INSTR_USE', '仪器使用记录表']]) {
  await page.goto(`${base}/#/panelx/list/${code}`, { timeout: 30000 })
  await page.reload({ timeout: 40000 })
  await page.waitForTimeout(8000)
  const st = await page.evaluate(() => {
    const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
    return {
      hash: location.hash,
      hasErrText: /列名|失败|错误|Exception|无效/.test(txt),
      tabs: [...document.querySelectorAll('.el-tabs__item')].map((e) => e.textContent.trim()).slice(0, 4),
      tables: document.querySelectorAll('.el-table').length,
      rows: document.querySelectorAll('.el-table__row').length,
      snippet: txt.slice(0, 120),
    }
  })
  console.log(code + ' ' + name + ' => ' + JSON.stringify(st))
  await restoreWindow()
  await page.screenshot({ path: `${OUT}/${code}.png` })
}
