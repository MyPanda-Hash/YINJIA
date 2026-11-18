// round-02:8090(正式账套)登录 → 打开检验数据记录 → 量步进器位置并点 ＋ 两次
const task = await taskSpace('qc-insp-rec-resultcols-ux-20261119')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 40000 })
await page.waitForTimeout(5000)

const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
console.log('needLogin ' + needLogin)
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
  const factory = await page.evaluate(() => (document.querySelector('.el-select__selected-item, .el-select__placeholder')?.textContent || '').trim())
  console.log('factory=' + JSON.stringify(factory))
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
    if (b) b.click()
  })
  await page.waitForTimeout(6000)
}

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6000)

const dump = async (tag) => {
  const st = await page.evaluate(() => {
    const step = document.querySelector('.qr-colstep')
    const r = step ? step.getBoundingClientRect() : null
    const btn = document.querySelector('.qr-colstep > span:nth-child(4)')
    const br = btn ? btn.getBoundingClientRect() : null
    return {
      logged: !document.querySelector('input[placeholder*="账号"]'),
      ledger: (document.body.innerText.match(/YINJIA-MES[^\s]*/) || [])[0] || '',
      stepperText: step ? (step.textContent || '').replace(/\s+/g, ' ').trim() : null,
      stepperRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      plusRect: br ? { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) } : null,
      headCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
      editableInputs: document.querySelectorAll('.qr-table tbody td.c-res input').length,
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await dump('initial')

const plus = await page.evaluate(() => !!document.querySelector('.qr-colstep > span:nth-child(4)'))
if (plus) {
  await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' })
  await page.waitForTimeout(600)
  await dump('after-plus-1')
  await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' })
  await page.waitForTimeout(600)
  await dump('after-plus-2')
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { /* skip */ }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-ux-20261119/round-02-8090.png' })

await page.reload({ timeout: 40000 })
await page.waitForTimeout(5000)
await dump('after-reload')
