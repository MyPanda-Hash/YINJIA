// round-23.mjs —— 验证「⧉ 去开不合格处理单」按钮已删除,且提示窗仍在(2026-11-24 第三轮口径)
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
for (let i = 0; i < 25; i++) {
  const n = await page.evaluate(() => document.querySelectorAll('.doc-select-rail tbody tr').length)
  if (n > 0) break
  await page.waitForTimeout(1000)
}
await page.waitForTimeout(1500)
const row = await page.evaluate(() => {
  const tr = document.querySelector('.doc-select-rail tbody tr')
  if (!tr) return null
  const t = (tr.innerText || '').replace(/\s+/g, ' ').trim()
  tr.querySelector('td')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return t
})
await page.waitForTimeout(7000)
// 动作条现状:不应再有「去开不合格处理单」
const band = await page.evaluate(() => ({
  acts: [...document.querySelectorAll('.qr-band-act')].map((e) => (e.innerText || '').trim()),
  hasOldButton: !!document.querySelector('.qr-band-ng'),
  bandText: (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' ').trim(),
}))
// 选「不合格」→ 提示窗仍在
await page.evaluate(() => {
  const th = [...document.querySelectorAll('th.qr-label')].find((x) => (x.innerText || '').trim() === '检验结论')
  th?.nextElementSibling?.querySelector('.el-select')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1200)
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const target = items.find((i) => (i.innerText || '').trim() === '不合格')
  target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return !!target
})
await page.waitForTimeout(1800)
const box = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].filter((x) => x.offsetParent !== null)[0]
  return b ? {
    title: (b.querySelector('.el-message-box__title')?.innerText || '').trim(),
    message: (b.querySelector('.el-message-box__message')?.innerText || '').replace(/\s+/g, ' ').trim(),
    buttons: [...b.querySelectorAll('button')].map((x) => (x.innerText || '').trim()).filter(Boolean),
  } : { shown: false }
})
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'C:/Users/vigna/ego/qc-bhcp-20261124/round-23-no-button.png' })
  console.log('SHOT OK')
} catch (e) { console.log('SHOT SKIP: ' + e.message.slice(0, 100)) }
// 关掉提示窗 + 丢弃改动
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].filter((x) => x.offsetParent !== null)[0]
  ;[...(b?.querySelectorAll('button') || [])].find((x) => (x.innerText || '').trim() === '暂不')?.click()
})
await page.waitForTimeout(800)
console.log(JSON.stringify({ row, band, picked, box }, null, 2))
await page.goto(URL, { timeout: 45000 })
await page.waitForTimeout(2500)
await task.finish({ keep: [] })
