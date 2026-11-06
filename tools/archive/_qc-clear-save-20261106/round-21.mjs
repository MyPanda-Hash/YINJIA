const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

// ── 登录 8090 的「测试库」账套(不拿正式库做试验)──
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 45000 })
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const sel = document.querySelector('.el-select')
  const inp = sel && sel.querySelector('input')
  if (inp) { inp.focus(); inp.click() }
})
await page.waitForTimeout(1200)
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const hit = items.find((n) => (n.textContent || '').includes('测试库'))
  if (hit) { hit.click(); return 'picked 测试库' }
  return 'options=' + JSON.stringify(items.map((n) => (n.textContent || '').trim()).slice(-3))
})
console.log('factory: ' + picked)
await page.waitForTimeout(600)
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
console.log('login -> ' + JSON.stringify(await page.evaluate(() => ({ hash: location.hash, body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 110) }))))

// ── 打开「来料检验要求」面板 ──
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REQ', { timeout: 45000 })
await page.waitForTimeout(9000)

const state = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')]
  const target = rows.find((tr) => (tr.innerText || '').includes('YJ-YCYX-006'))
  return {
    rowCount: rows.length,
    firstCell: target ? [...target.children].slice(0, 9).map((td) => (td.innerText || '').trim()) : null,
    editing: target ? target.getAttribute('data-edit') : null,
    tabs: [...document.querySelectorAll('.rsp-page-tab')].map((n) => (n.innerText || '').trim()),
  }
})
console.log('页面: ' + JSON.stringify(await state(), null, 2))

// 点该行「修改」→ 折数列(第 7 格,索引 6)写值/清空
async function editRow(idx, value) {
  const r = await page.evaluate(({ idx, value }) => {
    const rows = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')]
    const tr = rows.find((x) => (x.innerText || '').includes('YJ-YCYX-006'))
    if (!tr) return 'no-row'
    if (tr.getAttribute('data-edit') !== '1') {
      const edit = tr.querySelector('.rs-op-edit')
      if (edit) { edit.click(); return 'enter-edit' }
      return 'no-edit-btn'
    }
    const inp = tr.querySelectorAll('td .rs-c-in input')[idx]
    if (!inp) return 'no-input'
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(inp, value)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return 'set:' + JSON.stringify(value)
  }, { idx, value })
  return r
}
async function finishEdit() {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')]
    const tr = rows.find((x) => (x.innerText || '').includes('YJ-YCYX-006'))
    const done = tr && tr.querySelector('.rs-op-done')
    if (done) { done.click(); return 'done' }
    return 'no-done'
  })
}
async function save() {
  const r = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.qc-bar-btn')].find((b) => (b.innerText || '').trim() === '保存')
    if (btn) { btn.click(); return 'save-clicked' }
    return 'no-save'
  })
  await page.waitForTimeout(4000)
  const toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()))
  return { r, toasts }
}

// ① 改成 76±5
console.log('A1 ' + await editRow(6, '76±5'))
await page.waitForTimeout(800)
console.log('A2 ' + await editRow(6, '76±5'))
console.log('A3 ' + await finishEdit())
await page.waitForTimeout(800)
console.log('A4 ' + JSON.stringify(await save()))
console.log('A5 ' + JSON.stringify(await state()))

// ② 清空折数
await page.waitForTimeout(2000)
console.log('B1 ' + await editRow(6, '76±5'))
await page.waitForTimeout(800)
console.log('B2 ' + await editRow(6, ''))
console.log('B3 ' + await finishEdit())
await page.waitForTimeout(800)
console.log('B4 ' + JSON.stringify(await save()))
console.log('B5 ' + JSON.stringify(await state()))

// ③ 恢复 75±5
await page.waitForTimeout(2000)
console.log('C1 ' + await editRow(6, '75±5'))
await page.waitForTimeout(800)
console.log('C2 ' + await editRow(6, '75±5'))
console.log('C3 ' + await finishEdit())
await page.waitForTimeout(800)
console.log('C4 ' + JSON.stringify(await save()))
console.log('C5 ' + JSON.stringify(await state()))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-clear-save-20261106/round-21.png' })
