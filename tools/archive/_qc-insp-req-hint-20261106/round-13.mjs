const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

// ① 点开登录工厂下拉(登录页,当前显示 YINJIA-MES·测试库)
const open = await page.evaluate(() => {
  const sel = document.querySelector('.el-select')
  if (!sel) return 'no-select'
  const inp = sel.querySelector('input')
  if (inp) { inp.focus(); inp.click() }
  inp?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  return 'opened'
})
console.log('open -> ' + open)
await page.waitForTimeout(1800)

const opts = await page.evaluate(() =>
  [...document.querySelectorAll('.el-select-dropdown__item')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('options: ' + JSON.stringify(opts))

const pick = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const hit = items.find((n) => {
    const t = (n.textContent || '').replace(/\s+/g, ' ').trim()
    return t.startsWith('YINJIA-MES') && !t.includes('测试')
  })
  if (!hit) return 'no-option'
  hit.click()
  return 'picked: ' + (hit.textContent || '').replace(/\s+/g, ' ').trim()
})
console.log('pick -> ' + pick)
await page.waitForTimeout(1000)

// ② 账号 / 密码 / 进入系统
const fill = await page.evaluate(() => {
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  const setVal = (el, v) => { if (!el) return false; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true }
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  const a = setVal(acc, 'admin')
  const p = setVal(pwd, '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
  return { acc: a, pwd: p, btn: !!btn }
})
console.log('fill -> ' + JSON.stringify(fill))
await page.waitForTimeout(9000)

const after = await page.evaluate(() => ({ hash: location.hash, body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 150) }))
console.log('after login: ' + JSON.stringify(after))

// ③ 打开物料编码 = YJ-XH-001 的检验数据记录
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0084', { timeout: 45000 })
await page.waitForTimeout(7000)
const mat = await page.evaluate(() => {
  const el = document.querySelector('.qr-ref-text')
  return { material: el ? (el.textContent || '').trim() : null, hash: location.hash }
})
console.log('doc: ' + JSON.stringify(mat))

const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-lib-btn')].find((n) => (n.textContent || '').includes('检验要求') && !(n.textContent || '').includes('带入'))
  if (!el) return 'not-found'
  el.click()
  return 'clicked'
})
console.log('click -> ' + clicked)
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('来料检验要求'))
  if (!d) return { found: false, body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 260) }
  return {
    found: true,
    sub: (d.querySelector('.req-view-sub')?.innerText || '').replace(/\s+/g, ' ').trim(),
    warn: [...d.querySelectorAll('.req-view-warn')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()),
    tabLabels: [...d.querySelectorAll('.rsp-page-tab')].map((n) => (n.innerText || '').trim()),
    titles: [...d.querySelectorAll('.qc-title')].map((n) => (n.innerText || '').trim()),
    heads: [...d.querySelectorAll('.rs-th')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 16),
    rowCells: [...d.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24))).slice(0, 3),
  }
})
console.log('=== dialog ===')
console.log(JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-req-hint-20261106/round-13.png' })
