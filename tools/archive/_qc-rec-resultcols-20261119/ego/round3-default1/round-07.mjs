// round-07:验证「默认 1 格」在 8090 正式实例上生效(新单 1 格 → ＋ 加到 3 格;老单按库里存的列数)
const task = await taskSpace('qc-insp-rec-default1-20261119')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(6000)

const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
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
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
    if (b) b.click()
  })
  await page.waitForTimeout(6000)
  await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
  await page.reload({ timeout: 40000 })
  await page.waitForTimeout(6000)
}

const dump = async (tag) => {
  const st = await page.evaluate(() => ({
    chunk: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')).filter((s) => /index-[A-Za-z0-9_-]+\.js/.test(s))[0] || null,
    ledger: (document.body.innerText.match(/YINJIA-MES[^\s]*/) || [])[0] || '',
    docNo: (document.body.innerText.match(/JYSJ-\d{4}-\d{2}-\d{4}/) || [])[0] || '',
    n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
    headCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
    badge: document.querySelector('.c-result .c-result-count')?.textContent?.trim() ?? null,
    stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
    addbar: [...document.querySelectorAll('.qr-addbar .qr-add')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  }))
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await dump('initial(正式库, 应为 1 格)')

// ＋ 两次 → 3 格(不保存)
await page.click('.c-result .qr-addcol', { label: '新增列' })
await page.waitForTimeout(500)
await page.click('.c-result .qr-addcol', { label: '再加一列' })
await page.waitForTimeout(700)
await dump('after-add-2(应为 3 格)')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { /* skip */ }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-default1-20261119/round-07-8090-3cols.png' })

// 丢弃 + 看测试账套(那边 7 张单库里就是 5 格,应保持 5)
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4500)
await dump('after-reload(回 1 格)')
