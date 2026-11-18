// 出货检验表观「选生产工单」准入改为「进入末道工序」——界面取证 round-01
// 只读:只打开弹窗读列表,不点「确定」、不建单。
const OUT = 'C:/Users/vigna/ego/ship-insp-lastop-20261118'
const task = await taskSpace('ship-insp-lastop-20261118')
const page = task.page('p1')

// 1) 先登录拿 token(直接打 8090 接口,避免走登录页下拉选工厂)
const login = await fetch('http://127.0.0.1:8090/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
}).then((r) => r.json())
console.log('login code =', login.code)

await page.goto('http://localhost:5173/#/login', { timeout: 60000 })
await page.waitForTimeout(1500)
await page.evaluate((arg) => {
  localStorage.setItem('mes_token', arg.token)
  localStorage.setItem('mes_user', JSON.stringify(arg.user))
  localStorage.setItem('mes_locale', 'zh-CN')
}, { token: login.data.token, user: login.data.user })

// 2) 打开「出货检验表观」列表页
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 60000 })
await page.waitForTimeout(6000)

// 截图前恢复窗口(最小化时截图会失败)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  }
  await page.waitForTimeout(500)
} catch (e) {
  console.log('restore skip: ' + e.message)
}

const layout = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 40),
}))
console.log('layout =', JSON.stringify(layout, null, 2))

// 3) 点「选生产工单」
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('选生产工单'))
  if (!btn) return false
  btn.click()
  return true
})
console.log('clicked 选生产工单 =', clicked)
await page.waitForTimeout(4000)

const dump = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  if (!dlg) return { dialog: false, bodyText: (document.body.innerText || '').slice(0, 300) }
  return {
    dialog: true,
    tip: (dlg.querySelector('.wopick-tip') || {}).textContent?.trim(),
    gate: (dlg.querySelector('.wopick-gate') || {}).textContent?.trim(),
    heads: [...dlg.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim()),
    rows: [...dlg.querySelectorAll('.el-table__body tr')].slice(0, 8).map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
    total: (dlg.querySelector('.el-pagination__total') || {}).textContent?.trim(),
  }
})
console.log('dialog =', JSON.stringify(dump, null, 2))
await page.screenshot({ path: OUT + '/01-asm-picker.png' })

// 4) 对照:出货功能检验(QC_PROC_INSP)与首件检验(QC_FIRST_INSP)的弹窗话术/列不应变
const probes = []
for (const [code, tag] of [['QC_PROC_INSP', 'proc'], ['QC_FIRST_INSP', 'first']]) {
  await page.goto(`http://localhost:5173/#/panelx/list/${code}`, { timeout: 60000 })
  await page.waitForTimeout(5000)
  const ok = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('选生产工单'))
    if (!btn) return false
    btn.click()
    return true
  })
  await page.waitForTimeout(3500)
  const info = await page.evaluate(() => {
    const dlg = document.querySelector('.el-dialog')
    if (!dlg) return { dialog: false }
    return {
      dialog: true,
      tip: (dlg.querySelector('.wopick-tip') || {}).textContent?.trim(),
      gate: (dlg.querySelector('.wopick-gate') || {}).textContent?.trim(),
      heads: [...dlg.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim()),
    }
  })
  probes.push({ code, opened: ok, info })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
}
console.log('other pickers =', JSON.stringify(probes, null, 2))

await task.finish({ keep: [] })
