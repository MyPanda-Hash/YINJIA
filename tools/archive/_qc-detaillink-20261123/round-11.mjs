// round-11.mjs —— 兜底只用一次:深链落地(自动退到「全部」)后,用户点「未完成」应停在未完成
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const URL = 'http://localhost:5173/#/panelx/list/QC_ASM_INSP?docNo=ZJ-2026-11-0009'
await page.goto(URL, { timeout: 30000 })
await page.waitForTimeout(4000)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto(URL, { timeout: 30000 })
}
await page.waitForTimeout(9000)
const readTabs = () => [...document.querySelectorAll('.dsr-tab')].map((b) => ({ t: (b.innerText || '').trim(), on: b.classList.contains('active') }))
const landed = { tabs: await page.evaluate(readTabs), title: await page.evaluate(() => document.title), hash: await page.evaluate(() => location.hash) }
// 手点「未完成」
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.dsr-tab')].find((x) => (x.innerText || '').trim() === '未完成')
  b?.click()
})
await page.waitForTimeout(6000)
const afterSwitch = { tabs: await page.evaluate(readTabs), hash: await page.evaluate(() => location.hash) }
const activeAfter = afterSwitch.tabs.find((x) => x.on)?.t || ''
console.log(JSON.stringify({
  landed,
  afterSwitch,
  stayedOnTodo: activeAfter === '未完成',
  hijackedBackToAll: activeAfter === '全部',
}, null, 2))
await task.finish({ keep: [] })
