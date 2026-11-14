const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')

async function jwtSub() {
  return page.evaluate(() => {
    const t = localStorage.getItem('mes_token') || ''
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub } catch (e) { return null }
  })
}
async function logout() {
  await page.evaluate(() => { try { localStorage.removeItem('mes_token') } catch (e) {} })
  await page.goto('http://localhost:5173/', { timeout: 60000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => location.reload())
  await page.waitForTimeout(4500)
}
async function login(user) {
  await page.evaluate((u) => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
    const pw = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (acc) setVal(acc, u)
    if (pw) setVal(pw, '123456')
  }, user)
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6500)
}
if (await jwtSub() !== 'zfy') { await logout(); await login('zfy') }
console.log('sub=' + (await jwtSub()))

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 60000 })
await page.waitForTimeout(8000)

async function addOnce() {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.approval-side .as-side-btn')].find((b) => (b.textContent || '').replace(/\s+/g, '') === '新增')
    if (btn) btn.click()
  })
  await page.waitForTimeout(4500)
  return page.evaluate(() => {
    const el = document.querySelector('.as-side-no, .approval-side .as-no')
    const t = el ? (el.textContent || '').trim() : ''
    const head = [...document.querySelectorAll('.qr-head-table .qr-value')].map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 2)
    return { no: t, head }
  })
}
console.log('add1=' + JSON.stringify(await addOnce()))
console.log('add2=' + JSON.stringify(await addOnce()))
const list = await page.evaluate(() => [...document.querySelectorAll('.approval-side *')].map((e) => (e.textContent || '').trim()).filter((t) => /^JYSJ-/.test(t)).slice(0, 5))
console.log('docnos=' + JSON.stringify(list))
