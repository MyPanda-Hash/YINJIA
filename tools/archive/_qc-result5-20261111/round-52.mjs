const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
async function jwtSub() {
  return page.evaluate(() => {
    const t = localStorage.getItem('mes_token') || ''
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub } catch (e) { return null }
  })
}
if (await jwtSub() !== 'zfy') {
  await page.evaluate(() => { try { localStorage.removeItem('mes_token') } catch (e) {} })
  await page.goto('http://localhost:5173/', { timeout: 60000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => location.reload())
  await page.waitForTimeout(4500)
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
    const pw = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (acc) setVal(acc, 'zfy')
    if (pw) setVal(pw, '123456')
  })
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
    if (b) b.click()
  })
  await page.waitForTimeout(7000)
}
console.log('sub=' + (await jwtSub()))
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 60000 })
await page.waitForTimeout(8000)
console.log('add=' + await page.evaluate(() => {
  const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find((x) => (x.textContent || '').replace(/\s+/g, '') === '新增')
  if (!b) return 'NO-ADD'
  b.click(); return 'OK'
}))
await page.waitForTimeout(5000)
console.log('side=' + await page.evaluate(() => {
  const el = document.querySelector('.approval-side')
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24) : ''
}))
