// round-06:升级后新会话 —— 重新登录 YJ(正式库),再验「未完成最左且默认」/页签切换/深链/他面板
const OUT = 'C:/Users/vigna/ego/oqc-rail-tabs-20261110'
const task = await taskSpace('oqc-rail-tabs-20261110')
const page = task.page('p1')

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

const probe = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const rail = q('.doc-select-rail')
  const rows = rail ? [...rail.querySelectorAll('.dsr-grid tbody tr')] : []
  const active = rows.find((tr) => tr.classList.contains('active'))
  return {
    hash: location.hash,
    factory: txt(q('[class*="factory"]')),
    loginPage: !!q('input[placeholder*="密码"]'),
    tabs: [...document.querySelectorAll('.dsr-tabs .dsr-tab')].map((b) => ({ text: b.textContent.trim(), active: b.classList.contains('active') })),
    count: txt(q('.dsr-count')),
    pager: txt(q('.drp')),
    rowCount: rows.length,
    tagCounts: (rail ? [...rail.querySelectorAll('.dsr-grid tbody .dsr-tag')] : []).reduce((a, el) => { const k = el.textContent.trim(); a[k] = (a[k] || 0) + 1; return a }, {}),
    activeRow: active ? [...active.querySelectorAll('td')].map((td) => td.textContent.replace(/\s+/g, ' ').trim()) : null,
    noRail: !rail,
    errToasts: [...document.querySelectorAll('.el-message--error')].map((e) => e.textContent.trim()),
  }
})

const clickTab = async (label) => {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === t)
    if (b) b.click()
  }, label)
  await page.waitForTimeout(2600)
}

// ---- 重新登录(admin/123456,登录工厂保持默认 YINJIA-MES = 正式库)----
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(3500)
console.log('LOGIN_PAGE=' + JSON.stringify(await probe()))
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
console.log('AFTER_LOGIN=' + JSON.stringify(await probe()))
await shot('round-06-after-login')

// ---- 1) 打开出货检验单:默认应是「未完成」且在最左 ----
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(5000)
console.log('DEFAULT=' + JSON.stringify(await probe()))
await shot('round-06-default-todo')

// ---- 2) 已完成 / 全部 ----
await clickTab('已完成')
console.log('DONE=' + JSON.stringify(await probe()))
await shot('round-06-done')
await clickTab('全部')
console.log('ALL=' + JSON.stringify(await probe()))
await shot('round-06-all')

// ---- 3) 深链:已审核单(默认未完成页签看不到)⇒ 应回退全部并定位 ----
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP', { timeout: 30000 })
await page.waitForTimeout(2000)
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP?focus=ZC-2026-10-0126', { timeout: 30000 })
await page.waitForTimeout(5500)
console.log('FOCUS_DONE_DOC=' + JSON.stringify(await probe()))
await shot('round-06-focus-done-doc')

// ---- 4) 其他带左栏面板:仍然没有页签 ----
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 })
await page.waitForTimeout(4000)
console.log('OTHER_QC_FIRST=' + JSON.stringify(await probe()))
await shot('round-06-other-first-insp')

// ---- 5) 再打开出货检验单:默认仍是未完成 ----
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(4500)
console.log('BACK_DEFAULT=' + JSON.stringify(await probe()))
await shot('round-06-back-default')
