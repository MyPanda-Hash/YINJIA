// round-51:重新登录 YJ 后检查产成品入库单的新关联字段
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(3500)
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
await page.waitForTimeout(8000)
console.log('LOGIN=' + JSON.stringify(await page.evaluate(() => ({ hash: location.hash, factory: (document.querySelector('[class*="factory"]') || {}).textContent?.trim() }))))
await page.goto('http://localhost:5173/#/panelx/list/FINISH_IN', { timeout: 30000 })
await page.waitForTimeout(9000)
const out = await page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const labels = [...document.querySelectorAll('.field > label, .header-fields .field label, .fields .field label')]
    .map((l) => (l.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  return {
    hash: location.hash,
    docChip: txt(q('.doc-chip')),
    fieldLabelCount: labels.length,
    labels: labels.slice(0, 60),
    hasFunc: labels.some((x) => x.includes('出货检验功能单号')),
    hasLook: labels.some((x) => x.includes('出货检验表观单号')),
    errors: [...document.querySelectorAll('.el-message--error')].map((e) => e.textContent.trim()),
  }
})
console.log('FINISH_IN=' + JSON.stringify(out, null, 1).slice(0, 2500))
