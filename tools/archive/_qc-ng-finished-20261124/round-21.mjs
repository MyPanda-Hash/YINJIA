// round-21.mjs —— 验证「检验结论选成不合格 → 弹提示窗询问是否前往不合格单据」(2026-11-24 第二轮口径)
// 只读性质:只在纸面上改一次下拉(不保存),看到提示窗后点「暂不」并刷新丢弃改动。
const task = await taskSpace('qc-bhcp-20261124')
const page = task.page('p1')
const URL = 'http://localhost:5173/#/panelx/list/QC_ASM_INSP?docNo=ZJ-2026-11-0011'

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
await page.waitForTimeout(9000)

// 1) 找到「检验结论」那一格的下拉,点开
const opened = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('th.qr-label, .qr-label')]
  const th = labels.find((x) => (x.innerText || '').trim() === '检验结论')
  if (!th) return { ok: false, why: 'no-th' }
  const td = th.nextElementSibling
  const sel = td?.querySelector('.el-select')
  if (!sel) return { ok: false, why: 'no-select', tdHtml: (td?.innerHTML || '').slice(0, 160) }
  sel.querySelector('.el-select__wrapper, .el-input__inner')?.click?.()
  sel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true, current: (sel.innerText || '').trim() }
})
await page.waitForTimeout(1200)
// 2) 选「不合格」
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const target = items.find((i) => (i.innerText || '').trim() === '不合格')
  if (!target) return { ok: false, options: items.map((i) => (i.innerText || '').trim()).slice(0, 8) }
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true }
})
await page.waitForTimeout(1500)
// 3) 读提示窗(ElMessageBox)
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
  await page.screenshot({ path: 'C:/Users/vigna/ego/qc-bhcp-20261124/round-21-ng-confirm.png' })
  console.log('SHOT OK')
} catch (e) { console.log('SHOT SKIP: ' + e.message.slice(0, 100)) }

// 4) 点「暂不」→ 刷新丢弃未保存改动
const cancelled = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box')].filter((x) => x.offsetParent !== null)[0]
  const btn = [...(b?.querySelectorAll('button') || [])].find((x) => (x.innerText || '').trim() === '暂不')
  if (!btn) return false
  btn.click()
  return true
})
await page.waitForTimeout(1200)
console.log(JSON.stringify({ opened, picked, box, cancelled }, null, 2))
// 丢弃未保存改动(直接重新导航)
await page.goto(URL, { timeout: 45000 })
await page.waitForTimeout(3000)
await task.finish({ keep: [] })
