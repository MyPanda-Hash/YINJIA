// round-22.mjs —— 走正常入口(左栏点行)后改「检验结论=不合格」验提示窗(2026-11-24 第二轮口径)
// 说明:round-21 用 ?docNo= 深链落地是只读态(草稿状态的判定取自列表行),这里改用「左栏点行」的正常路径。
const task = await taskSpace('qc-bhcp-20261124')
const page = task.page('p1')
const URL = 'http://localhost:5173/#/panelx/list/QC_ASM_INSP'

await page.goto(URL, { timeout: 45000 })
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
  await page.waitForTimeout(8000)
  await page.goto(URL, { timeout: 45000 })
}
// 等左栏出单
for (let i = 0; i < 25; i++) {
  const n = await page.evaluate(() => document.querySelectorAll('.doc-select-rail .dsr-grid tbody tr, .doc-select-rail tbody tr').length)
  if (n > 0) break
  await page.waitForTimeout(1000)
}
await page.waitForTimeout(2000)
// 点第一行(草稿)
const pickedRow = await page.evaluate(() => {
  const tr = document.querySelector('.doc-select-rail .dsr-grid tbody tr, .doc-select-rail tbody tr')
  if (!tr) return null
  const text = (tr.innerText || '').replace(/\s+/g, ' ').trim()
  tr.querySelector('td')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return text
})
await page.waitForTimeout(7000)
// 找检验结论下拉
const state = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('th.qr-label, .qr-label')]
  const th = labels.find((x) => (x.innerText || '').trim() === '检验结论')
  const td = th?.nextElementSibling
  return {
    rowPicked: true,
    hasTh: !!th,
    tdHtml: (td?.innerHTML || '').slice(0, 200),
    hasSelect: !!td?.querySelector('.el-select'),
    editable: !!td?.querySelector('.el-select'),
  }
})
const opened = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('th.qr-label, .qr-label')]
  const th = labels.find((x) => (x.innerText || '').trim() === '检验结论')
  const sel = th?.nextElementSibling?.querySelector('.el-select')
  if (!sel) return { ok: false }
  sel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true }
})
await page.waitForTimeout(1200)
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const target = items.find((i) => (i.innerText || '').trim() === '不合格')
  if (!target) return { ok: false, options: items.map((i) => (i.innerText || '').trim()).slice(0, 8) }
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true }
})
await page.waitForTimeout(1800)
const box = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].filter((x) => x.offsetParent !== null)[0]
  if (!b) return { shown: false }
  return {
    shown: true,
    title: (b.querySelector('.el-message-box__title')?.innerText || '').trim(),
    message: (b.querySelector('.el-message-box__message')?.innerText || '').replace(/\s+/g, ' ').trim(),
    buttons: [...b.querySelectorAll('button')].map((x) => (x.innerText || '').trim()).filter(Boolean),
  }
})
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'C:/Users/vigna/ego/qc-bhcp-20261124/round-22-ng-confirm.png' })
  console.log('SHOT OK')
} catch (e) { console.log('SHOT SKIP: ' + e.message.slice(0, 100)) }
const cancelled = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].filter((x) => x.offsetParent !== null)[0]
  const btn = [...(b?.querySelectorAll('button') || [])].find((x) => (x.innerText || '').trim() === '暂不')
  if (!btn) { b?.querySelector('.el-message-box__headerbtn')?.click?.(); return false }
  btn.click()
  return true
})
await page.waitForTimeout(1000)
console.log(JSON.stringify({ pickedRow, state, opened, picked, box, cancelled }, null, 2))
// 丢弃未保存改动
await page.goto(URL, { timeout: 45000 })
await page.waitForTimeout(3000)
await task.finish({ keep: [] })
