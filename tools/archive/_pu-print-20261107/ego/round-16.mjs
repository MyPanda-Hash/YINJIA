// round-16:切英文验收弹窗文案(用 localStorage 的 mes_locale,验完切回简体)
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(4000)
const prev = await page.evaluate(() => localStorage.getItem('mes_locale'))
console.log('prev locale=' + prev)

await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6000)

const afterReload = await page.evaluate(() => ({
  hash: location.hash,
  htmlLang: document.documentElement.lang,
  locale: localStorage.getItem('mes_locale'),
  railHead: (document.querySelector('.doc-select-rail')?.textContent || '').replace(/\s+/g, ' ').slice(0, 80),
}))
console.log('afterReload=' + JSON.stringify(afterReload, null, 2))

// 若掉回登录页,重新登录
const atLogin = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('input')]
  return location.hash.includes('/login') || ins.some((i) => (i.placeholder || '').includes('账号') || (i.placeholder || '').toLowerCase().includes('account'))
})
if (atLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => /账号|account/i.test(i.placeholder || ''))
    const p = ins.find((i) => /密码|password/i.test(i.placeholder || ''))
    if (u) setVal(u, 'admin')
    if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => /进入系统|Sign in|Enter/i.test(b.textContent || ''))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  console.log('relogged hash=' + (await page.evaluate(() => location.hash)))
}

// 选中 7 行订单并打开打印弹窗
const opened = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const row = [...document.querySelectorAll('tbody tr')].find((r) => txt(r).includes('YJ-20261012-11') && r.getBoundingClientRect().height > 0)
  if (!row) return 'row not found'
  row.scrollIntoView({ block: 'center' })
  row.click()
  return 'selected'
})
console.log(opened)
await page.waitForTimeout(2500)
const clickPrint = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-group .tb-main')].find((n) => /打印|Print/.test((n.textContent || '').trim()))
  if (!el) return 'no print btn'
  el.click()
  return 'clicked'
})
console.log(clickPrint)
await page.waitForTimeout(3000)

const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  if (!root) return { open: false, tail: txt(document.body).slice(-200) }
  return {
    open: true,
    title: txt(document.querySelector('.el-dialog__header')),
    tip: txt(root.querySelector('.pup-tip')),
    headers: [...root.querySelectorAll('.el-table__header th')].map(txt),
    radio: [...root.querySelectorAll('.el-radio-button')].map(txt),
    foot: txt(root.querySelector('.pup-foot')),
    buttons: [...document.querySelectorAll('.el-dialog__footer button')].map(txt),
  }
})
console.log('dialog=' + JSON.stringify(dlg, null, 2))
try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-16-en.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-16-en.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw shot=' + p)
  } catch (e2) { console.log('raw shot fail: ' + e2.message) }
}

// 复原:切回简体中文
await page.keyboard.press('Escape')
await page.evaluate((v) => localStorage.setItem('mes_locale', v || 'zh-CN'), prev)
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
console.log('restored locale=' + (await page.evaluate(() => localStorage.getItem('mes_locale'))))
