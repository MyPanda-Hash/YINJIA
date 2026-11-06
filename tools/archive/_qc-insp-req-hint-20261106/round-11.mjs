const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

// 退出当前会话(现在登的是 测试库),重新以「正式库 YJ」登录
await page.evaluate(() => { try { localStorage.removeItem('mes_token') } catch { /* ignore */ } })
await page.goto('http://localhost:5173/#/login', { timeout: 45000 })
await page.waitForTimeout(4000)

// ① 点开「登录工厂」下拉
const opened = await page.evaluate(() => {
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('登录工厂'))
  if (!inp) return 'no-select'
  inp.click()
  inp.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  return 'opened'
})
console.log('factory select -> ' + opened)
await page.waitForTimeout(1500)
const options = await page.evaluate(() =>
  [...document.querySelectorAll('.el-select-dropdown__item, .el-option')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('options: ' + JSON.stringify(options))

// ② 选「正式库」(文本含 YINJIA-MES 且不含 测试库)
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item, .el-option')]
  const hit = items.find((n) => {
    const t = (n.textContent || '').replace(/\s+/g, ' ').trim()
    return t.includes('YINJIA-MES') && !t.includes('测试')
  })
  if (!hit) return 'no-option'
  hit.click()
  return 'picked: ' + (hit.textContent || '').replace(/\s+/g, ' ').trim()
})
console.log('pick -> ' + picked)
await page.waitForTimeout(800)

// ③ 账号/密码 + 进入系统
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(7000)
const who = await page.evaluate(() => ({ hash: location.hash, body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160) }))
console.log('after login: ' + JSON.stringify(who))

// ④ 打开物料编码 = YJ-XH-001 的检验数据记录
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
  if (!d) return { found: false, text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300) }
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
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-req-hint-20261106/round-11.png' })
