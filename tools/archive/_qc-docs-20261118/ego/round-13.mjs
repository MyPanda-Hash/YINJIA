const task = await taskSpace('qc-docs-20261118')
const page = task.page('p1')

async function waitFor(fn, timeout = 25000, step = 300) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const v = await page.evaluate(fn)
    if (v) return v
    await page.waitForTimeout(step)
  }
  return null
}

// 切到测试库(附件探针单在测试库)
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await waitFor(() => !!document.querySelector('input[placeholder*="密码"]'))
await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await waitFor(() => !!document.querySelector('input[placeholder*="密码"]'))
await page.waitForTimeout(1500)
await page.evaluate(() => {
  const sel = document.querySelector('.el-select')
  const inner = sel && (sel.querySelector('.el-select__wrapper, .el-input__inner') || sel)
  inner && inner.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(900)
const picked = await page.evaluate(() => {
  const t = [...document.querySelectorAll('.el-select-dropdown__item')].find((i) => (i.textContent || '').includes('测试'))
  if (!t) return false
  t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return true
})
await page.evaluate(() => {
  const setVal = (el, v) => {
    if (!el) return
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
})
await page.waitForTimeout(300)
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); b && b.click() })
await waitFor(() => !location.hash.includes('login'), 25000)
await page.waitForTimeout(2000)
console.log('picked 测试库:', picked)

await page.goto('http://localhost:5173/#/panelx/list/QC_BHZ?docNo=BHZ-2026-11-0003', { timeout: 30000 })
await page.waitForTimeout(5000)
const before = await page.evaluate(() => {
  const cell = document.querySelector('.as-attach-inline')
  return {
    chips: [...document.querySelectorAll('.as-attach-inline .fac-chip')].map((c) => (c.textContent || '').trim()),
    legacy: (document.querySelector('.as-attach-inline .fac-legacy') || {}).textContent || '',
    text: (cell || {}).textContent || '',
  }
})
console.log('before delete:', JSON.stringify(before))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r13-before-delete.png' })

// 点 ✕ → 确认删除
const clicked = await page.evaluate(() => {
  const x = document.querySelector('.as-attach-inline .fac-del')
  if (!x) return false
  x.click()
  return true
})
await page.waitForTimeout(1200)
const confirmed = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box__btns button')].find((x) => (x.textContent || '').replace(/\s+/g, '') === '确定')
  if (!b) return false
  b.click()
  return true
})
await page.waitForTimeout(2500)
const after = await page.evaluate(() => {
  const cell = document.querySelector('.as-attach-inline')
  return {
    chips: [...document.querySelectorAll('.as-attach-inline .fac-chip')].map((c) => (c.textContent || '').trim()),
    legacy: (document.querySelector('.as-attach-inline .fac-legacy') || {}).textContent || '',
    text: (cell || {}).textContent || '',
    hash: location.hash,
  }
})
console.log('clicked ✕:', clicked, 'confirmed:', confirmed)
console.log('after delete (未刷新):', JSON.stringify(after))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r13-after-delete.png' })
console.log('done')
