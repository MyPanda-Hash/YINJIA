// 出货检验表观(QC_ASM_INSP)版面复现 —— 第 1 轮:登录 + 打开面板 + 看列表与按钮
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 60000 })
await page.waitForTimeout(4000)

// 会话过期 → 走登录页
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
console.log(JSON.stringify({ needLogin, url: await page.url() }))
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
  await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 60000 })
  await page.waitForTimeout(5000)
}

const info = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    title: document.title,
    tools: [...document.querySelectorAll('.tools span, .tools button, .tool-btn')].map(txt).filter(Boolean).slice(0, 40),
    sheet: !!document.querySelector('.qr-sheet'),
    sheetTitle: document.querySelector('.qr-title')?.textContent,
    railRows: [...document.querySelectorAll('.doc-select-rail li, .doc-select-rail .rail-row')].map(txt).slice(0, 5),
    bodySnippet: txt(document.body).slice(0, 300),
  }
})
console.log(JSON.stringify(info, null, 2))

const w = await page.cdp('Browser.getWindowForTarget', {})
if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
await page.waitForTimeout(400)
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-01.png' })
