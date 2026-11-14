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
if (await jwtSub() !== 'fm') { await logout(); await login('fm') }
console.log('sub=' + (await jwtSub()))

async function openDoc(no) {
  await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=' + no, { timeout: 60000 })
  await page.waitForTimeout(8000)
}
// ① 审批通过 0003
await openDoc('JYSJ-2026-11-0003')
console.log('approve click=' + await page.evaluate(() => {
  const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find((x) => (x.textContent || '').replace(/\s+/g, '') === '审批通过')
  if (!b) return 'NO-BTN'
  b.click(); return 'OK'
}))
await page.waitForTimeout(1500)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message-box')].find((x) => x.offsetParent !== null)
  const b = d && [...d.querySelectorAll('button')].find((x) => /确认审批通过/.test(x.textContent || ''))
  if (b) b.click()
})
await page.waitForTimeout(4000)
console.log('after approve=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()))))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-38-approve.png' })

// ② 审批驳回 0004
await openDoc('JYSJ-2026-11-0004')
console.log('reject click=' + await page.evaluate(() => {
  const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find((x) => (x.textContent || '').replace(/\s+/g, '') === '审批驳回')
  if (!b) return 'NO-BTN'
  b.click(); return 'OK'
}))
await page.waitForTimeout(1800)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null)
  return d ? { text: (d.textContent || '').replace(/\s+/g, ' ').slice(0, 90), inputs: [...d.querySelectorAll('input,textarea')].map((i) => i.tagName + ':' + (i.placeholder || '')) } : null
})
console.log('reject dialog=' + JSON.stringify(dlg))
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return
  const inp = d.querySelector('textarea, input')
  if (inp) {
    const proto = inp.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const s = Object.getOwnPropertyDescriptor(proto, 'value').set
    s.call(inp, '尺寸实测 437.9/438.0 超出 436±0.5，请复检后重新提交')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
  }
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null)
  const b = d && [...d.querySelectorAll('button')].find((x) => /确认审批驳回/.test(x.textContent || ''))
  if (b) b.click()
})
await page.waitForTimeout(4000)
console.log('after reject=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()))))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-38-reject.png' })
