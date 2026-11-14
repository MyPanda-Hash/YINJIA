const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
async function jwtSub() {
  return page.evaluate(() => {
    const t = localStorage.getItem('mes_token') || ''
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub } catch (e) { return null }
  })
}
// 退出 → 选测试库 → 登录 zfy
await page.evaluate(() => { try { localStorage.removeItem('mes_token') } catch (e) {} })
await page.goto('http://127.0.0.1:8090/', { timeout: 60000 })
await page.waitForTimeout(2000)
await page.evaluate(() => location.reload())
await page.waitForTimeout(5000)
console.log('factory-selects=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-select')].map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim()))))
// 点开登录工厂下拉
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.el-select')].find((s) => /YINJIA-MES/.test(s.textContent || ''))
  if (sel) sel.querySelector('.el-select__wrapper')?.click() || sel.click()
})
await page.waitForTimeout(1500)
console.log('options=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((o) => (o.textContent || '').trim()))))
console.log('pick=' + await page.evaluate(() => {
  const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((o) => /测试库/.test(o.textContent || ''))
  if (!opt) return 'NO-OPT'
  opt.click()
  return 'PICKED'
}))
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'zfy')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
})
await page.waitForTimeout(600)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
  if (b) b.click()
})
await page.waitForTimeout(8000)
console.log('sub=' + (await jwtSub()) + ' factory=' + (await page.evaluate(() => localStorage.getItem('mes_factory'))))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}

await page.evaluate(() => { const el = document.querySelector('.nc-ref.type-msg'); if (el) el.click() })
await page.waitForTimeout(2500)
console.log('items=' + JSON.stringify((await page.evaluate(() => [...document.querySelectorAll('.nc-item')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)))).slice(0, 4), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-43-8090-msglist.png' })
console.log('click=' + await page.evaluate(() => {
  const hit = [...document.querySelectorAll('.nc-item')].find((el) => (el.textContent || '').includes('JYSJ-2026-11-0004'))
  if (!hit) return 'NOT-FOUND'
  hit.click(); return 'OK'
}))
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const b = d && [...d.querySelectorAll('button')].find((x) => /去处理/.test(x.textContent || ''))
  if (b) b.click()
})
await page.waitForTimeout(8000)
console.log('jump=' + JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return { hash: location.hash, side: (txt(document.querySelector('.approval-side')) || '').slice(0, 32), rows: [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) => [...tr.querySelectorAll('td.c-res')].map((c) => { const i = c.querySelector('input'); return i ? i.value : (txt(c) || '') })) }
})))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-43-8090-jump.png' })
