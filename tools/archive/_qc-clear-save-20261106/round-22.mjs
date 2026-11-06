const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

// ── 切到 8090 的「测试库」账套(不拿正式库做试验):先退登录,再选工厂 ──
await page.evaluate(() => { try { localStorage.removeItem('mes_token') } catch { /* ignore */ } })
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 45000 })
await page.reload({ timeout: 45000 })
await page.waitForTimeout(5000)

const onLogin = await page.evaluate(() => ({
  hash: location.hash,
  hasFactory: !!document.querySelector('.el-select'),
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
}))
console.log('login page: ' + JSON.stringify(onLogin))

await page.evaluate(() => {
  const sel = document.querySelector('.el-select')
  const inp = sel && sel.querySelector('input')
  if (inp) { inp.focus(); inp.click() }
})
await page.waitForTimeout(1500)
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const hit = items.find((n) => (n.textContent || '').includes('测试库'))
  if (hit) { hit.click(); return 'picked 测试库' }
  return 'options=' + JSON.stringify(items.map((n) => (n.textContent || '').trim()))
})
console.log('factory: ' + picked)
await page.waitForTimeout(800)
await page.evaluate(() => {
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  const setVal = (el, v) => { if (!el) return; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(9000)
console.log('after login: ' + JSON.stringify(await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 110))))

// ── 来料检验要求:折叠棉 YJ-YCYX-006 的「折数」→ 改值 / 清空 / 还原 ──
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REQ', { timeout: 45000 })
await page.waitForTimeout(9000)

async function rowIndex() {
  return page.evaluate(() => [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')]
    .findIndex((tr) => (tr.innerText || '').includes('YJ-YCYX-006')))
}
async function readRow() {
  return page.evaluate(() => {
    const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')].find((x) => (x.innerText || '').includes('YJ-YCYX-006'))
    return tr ? [...tr.children].map((td) => (td.innerText || '').trim()) : null
  })
}
async function enterEdit(idx) {
  return page.evaluate((idx) => {
    const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')][idx]
    if (!tr) return 'no-row'
    const b = tr.querySelector('.rs-op-edit')
    if (b) { b.click(); return 'edit' }
    return tr.getAttribute('data-edit') === '1' ? 'already' : 'no-btn'
  }, idx)
}
async function setCell(idx, col, value) {
  return page.evaluate(({ idx, col, value }) => {
    const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')][idx]
    if (!tr) return 'no-row'
    const inp = tr.querySelectorAll('td .rs-c-in input')[col]
    if (!inp) return 'no-input(' + tr.querySelectorAll('td .rs-c-in input').length + ')'
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(inp, value)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return 'set=' + JSON.stringify(value)
  }, { idx, col, value })
}
async function done(idx) {
  return page.evaluate((idx) => {
    const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')][idx]
    const b = tr && tr.querySelector('.rs-op-done')
    if (b) { b.click(); return 'done' }
    return 'no-done'
  }, idx)
}
async function save() {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.qc-bar-btn')].find((b) => (b.innerText || '').trim() === '保存')
    if (btn) btn.click()
  })
  await page.waitForTimeout(4500)
  return page.evaluate(() => [...document.querySelectorAll('.el-message')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()))
}

let idx = await rowIndex()
console.log('row index = ' + idx + ' 原值: ' + JSON.stringify(await readRow()))

// ① 改值 76±5
console.log('A ' + await enterEdit(idx)) ; await page.waitForTimeout(700)
console.log('A ' + await setCell(idx, 6, '76±5')) ; await page.waitForTimeout(500)
console.log('A ' + await done(idx)) ; await page.waitForTimeout(600)
console.log('A save: ' + JSON.stringify(await save()))

// ② 清空
await page.waitForTimeout(1500)
idx = await rowIndex()
console.log('B ' + await enterEdit(idx)) ; await page.waitForTimeout(700)
console.log('B ' + await setCell(idx, 6, '')) ; await page.waitForTimeout(500)
console.log('B ' + await done(idx)) ; await page.waitForTimeout(600)
console.log('B save: ' + JSON.stringify(await save()))

// ③ 还原 75±5
await page.waitForTimeout(1500)
idx = await rowIndex()
console.log('C ' + await enterEdit(idx)) ; await page.waitForTimeout(700)
console.log('C ' + await setCell(idx, 6, '75±5')) ; await page.waitForTimeout(500)
console.log('C ' + await done(idx)) ; await page.waitForTimeout(600)
console.log('C save: ' + JSON.stringify(await save()))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-clear-save-20261106/round-22.png' })
