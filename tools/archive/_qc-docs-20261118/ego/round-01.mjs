const task = await taskSpace('qc-docs-20261118')
const page = await task.newPage()

async function waitFor(fn, timeout = 20000, step = 300) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const v = await page.evaluate(fn)
    if (v) return v
    await page.waitForTimeout(step)
  }
  return null
}

async function loginAs(factoryText, user = 'admin', pwd = '123456') {
  await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
  await waitFor(() => !!document.querySelector('input[placeholder*="密码"]'))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
  await waitFor(() => !!document.querySelector('input[placeholder*="密码"]'))
  await page.waitForTimeout(1200)
  // 打开工厂下拉并选目标
  await page.evaluate(() => {
    const sel = document.querySelector('.el-select')
    const inner = sel && (sel.querySelector('.el-select__wrapper, .el-input__inner') || sel)
    inner && inner.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(900)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((i) => (i.textContent || '').trim()))
  console.log('factory options:', JSON.stringify(opts))
  const picked = await page.evaluate((want) => {
    const t = [...document.querySelectorAll('.el-select-dropdown__item')].find((i) => (i.textContent || '').trim() === want)
    if (!t) return false
    t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  }, factoryText)
  console.log('picked', factoryText, ':', picked)
  await page.waitForTimeout(500)
  await page.evaluate(([u, p]) => {
    const setVal = (el, v) => {
      if (!el) return
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), u)
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), p)
  }, [user, pwd])
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
    if (b) b.click()
  })
  await waitFor(() => !location.hash.includes('login'), 25000)
  await page.waitForTimeout(2500)
  return await page.evaluate(() => {
    const top = (document.querySelector('header, .top, .app-top') || document.body).textContent.replace(/\s+/g, ' ')
    return { hash: location.hash, factory: (top.match(/YINJIA-MES[^ ]*/) || [''])[0] }
  })
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1050 } })
} catch (e) {}

const st = await loginAs('YINJIA-MES·测试库')
console.log('logged in:', JSON.stringify(st))

const no = process.env.DOC_NO || 'BHZ-2026-11-0003'
await page.goto(`http://localhost:5173/#/panelx/list/QC_BHZ?docNo=${no}`, { timeout: 30000 })
await page.waitForTimeout(5000)
const info = await page.evaluate(() => {
  const sheet = document.querySelector('.approval-sheet') || document.body
  return {
    info: [...document.querySelectorAll('.as-info-row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()),
    firstRows: [...document.querySelectorAll('.as-row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 4),
    hasAttach: !!document.querySelector('.as-attach-inline'),
    attachText: (document.querySelector('.as-attach-inline') || {}).textContent || '',
    uploadBtn: [...document.querySelectorAll('.fac-upload-btn')].map((b) => (b.textContent || '').trim()),
    foot: [...sheet.querySelectorAll('div')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => /^(编制|审核|批准)：/.test(t)).slice(0, 1),
    dateSpans: [...sheet.querySelectorAll('.q-sign-date')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 6),
  }
})
console.log('QC_BHZ:', JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-docs-20261118/r01-bhz.png' })
console.log('done')
