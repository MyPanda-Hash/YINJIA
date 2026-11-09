const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')

// 直接在页面里登录测试库并把会话写进 localStorage(比点登录表单稳)
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(1500)
const ok = await page.evaluate(async () => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const j = await res.json()
  if (!j?.data?.token) return { err: j }
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user || {}))
  localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
  return { ok: true, factory: JSON.parse(localStorage.getItem('mes_factory') || 'null') }
})
console.log('login=' + JSON.stringify(ok))

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_EQUIP_USE', { timeout: 30000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(7000)
const list = await page.evaluate(() => [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('list=' + JSON.stringify(list))
await page.click('.labm-line >> nth=0')
await page.waitForTimeout(3500)
const st = await page.evaluate(() => ({
  doc: document.querySelector('.labm-doc')?.textContent?.trim() || '',
  rows: document.querySelectorAll('.labm-drow').length,
  openRows: [...document.querySelectorAll('.labm-drow-body')].filter((e) => e.offsetParent !== null).length,
  summaries: [...document.querySelectorAll('.labm-drow-sum')].map((e) => e.textContent.trim()),
  badges: [...document.querySelectorAll('.labm-drow-badge')].map((e) => e.textContent.trim()),
  bigBtns: [...document.querySelectorAll('.labm-sec .el-button')].map((b) => ({ t: (b.textContent || '').trim(), h: Math.round(b.getBoundingClientRect().height) })),
  delBtns: [...document.querySelectorAll('.labm-drow-head .el-button')].map((b) => ({ t: (b.textContent || '').trim(), h: Math.round(b.getBoundingClientRect().height), disabled: b.disabled })),
  clearBtn: (() => {
    const b = [...document.querySelectorAll('.labm-actions .el-button')].find((x) => (x.textContent || '').includes('清空'))
    return b ? { h: Math.round(b.getBoundingClientRect().height), disabled: b.disabled } : null
  })(),
}))
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-80-collapsed.png' })

await page.click('css:.labm-drow-head >> nth=0')
await page.waitForTimeout(1200)
const exp = await page.evaluate(() => ({
  openRows: [...document.querySelectorAll('.labm-drow-body')].filter((e) => e.offsetParent !== null).length,
  attItems: [...document.querySelectorAll('.labm-att')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  imgs: document.querySelectorAll('.labm-drow-body img').length,
  uploadBtn: [...document.querySelectorAll('.labm-rowphoto .el-button')].map((b) => (b.textContent || '').trim()),
}))
console.log('expanded=' + JSON.stringify(exp, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-81-expanded-attach.png' })
