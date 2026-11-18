// round-11:8090 最终复核「默认 1 格」+ ＋ 加列 + A4 打印 1 列版面
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
  await page.waitForTimeout(300)
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
    n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
    headCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
    badge: document.querySelector('.c-result .c-result-count')?.textContent?.trim() ?? null,
    stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
    addbar: [...document.querySelectorAll('.qr-addbar .qr-add')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  }))
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await dump('initial')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { /* skip */ }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-default1-20261119/round-11-8090-default1.png' })

await page.click('.c-result .qr-addcol', { label: '新增列' })
await page.waitForTimeout(700)
await dump('after-add')

// A4 打印态(2 列)
await page.evaluate(() => document.body.classList.add('approval-printing'))
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 1, mobile: false })
await page.waitForTimeout(900)
const pr = await page.evaluate(() => {
  const band = document.querySelector('.qr-table thead tr:first-child th.c-result')
  const cells = [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th.c-res')]
  const r = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null)
  return { n: cells.length, bandW: r(band), resW: r(cells[0]), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }
})
console.log('a4-2 ' + JSON.stringify(pr))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-default1-20261119/round-11-a4-2col.png', fullPage: true })
await page.cdp('Emulation.clearDeviceMetricsOverride')
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
await page.evaluate(() => document.body.classList.remove('approval-printing'))

// 不保存 → 刷新回 1 格
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
await dump('after-reload')
