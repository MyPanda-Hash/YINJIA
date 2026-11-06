const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/login', { timeout: 45000 })
await page.waitForTimeout(4000)

// 工厂选择(默认可能是测试库,强制选正式库)
const open = await page.evaluate(() => {
  const sel = document.querySelector('.el-select')
  if (!sel) return 'no-select'
  const inp = sel.querySelector('input')
  if (inp) { inp.focus(); inp.click() }
  return 'opened'
})
await page.waitForTimeout(1200)
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const hit = items.find((n) => (n.textContent || '').replace(/\s+/g, ' ').trim() === 'YINJIA-MES')
  if (hit) { hit.click(); return 'picked' }
  return 'options=' + JSON.stringify(items.map((n) => (n.textContent || '').trim()).slice(-3))
})
console.log('factory: ' + open + ' / ' + picked)
await page.waitForTimeout(600)

const fill = await page.evaluate(() => {
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  const setVal = (el, v) => { if (!el) return false; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true }
  const ins = [...document.querySelectorAll('input')]
  const a = setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  const p = setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
  return { acc: a, pwd: p, btn: !!btn }
})
console.log('login: ' + JSON.stringify(fill))
await page.waitForTimeout(9000)
console.log('after login: ' + JSON.stringify(await page.evaluate(() => ({ hash: location.hash, body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 90) }))))

// 打开一张草稿、物料有要求的检验数据记录
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0077', { timeout: 45000 })
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-lib-btn')].find((n) => (n.textContent || '').includes('检验要求') && !(n.textContent || '').includes('带入'))
  if (el) el.click()
})
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const out = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('来料检验要求'))
  return {
    dialogOpen: !!d,
    sub: d ? (d.querySelector('.req-view-sub')?.innerText || '').replace(/\s+/g, ' ').trim() : '',
    footerBtns: d ? [...d.querySelectorAll('.el-dialog__footer button')].map((b) => ({ text: (b.innerText || '').replace(/\s+/g, ' ').trim(), disabled: !!b.disabled || b.classList.contains('is-disabled') })) : [],
    status: (() => { const t = document.querySelector('.doc-status'); return t ? (t.innerText || '').trim() : '' })(),
    servedChunk: [...document.querySelectorAll('script[src*="assets/index-"]')].map((s) => s.getAttribute('src')),
  }
})
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-req-hint-20261106/round-20-8090.png' })
