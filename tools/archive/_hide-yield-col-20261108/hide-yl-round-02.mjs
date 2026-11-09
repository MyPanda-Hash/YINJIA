// hide-yl-round-02.mjs — 四页列头复核 + 截图证据(生产工单/工单排产/快速排产/生产工序进度看板)
const fs = await import('node:fs/promises')
const OUT = 'D:/workspace/yinjia/.tmp/ego/hide-yl'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')

async function ensureLogin(url) {
  await page.goto(url, { timeout: 40000 })
  await page.waitForTimeout(6000)
  const need = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')))
  if (!need) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin')
    if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  return true
}

async function probe(url, label, clickLine) {
  const logged = await ensureLogin(url)
  if (logged) { await page.goto(url, { timeout: 40000 }); await page.waitForTimeout(6500) }
  if (clickLine) {
    const picked = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.wb-line')]
      const t = els.find((el) => (el.querySelector('.wb-line-name') || el).textContent.trim().startsWith('2号车间'))
      if (!t) return null
      t.click()
      return '2号车间'
    })
    console.log(label + ' picked=' + JSON.stringify(picked))
    await page.waitForTimeout(5500)
  }
  const info = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('.el-table__header th')].map((t) => (t.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    const bodyText = document.body.innerText || ''
    return {
      hash: location.hash,
      tableHeads: heads.length,
      hasYlHead: heads.some((h) => h.includes('余量')),
      bodyHasYlLabel: /余量/.test(bodyText),
      rows: document.querySelectorAll('.el-table__body tbody tr').length,
      cards: document.querySelectorAll('[class*="wpb-card"], .wpb-row').length,
    }
  })
  console.log(label + ' | ' + JSON.stringify(info))
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: OUT + '/' + label + '.png' })
  return info
}

const a = await probe('http://localhost:5173/#/prod/plan/workOrderList', 'R2-A-workorder-list')
const b = await probe('http://localhost:5173/#/prod/plan/workOrderBoard', 'R2-B-workorder-board', true)
const c = await probe('http://localhost:5173/#/prod/plan/scheduleBoard', 'R2-C-schedule-board')
const d = await probe('http://localhost:5173/#/prod/plan/workOrderProgress', 'R2-D-progress-board')
console.log('RESULT 页面里是否还有「余量」字样: 生产工单=' + a.bodyHasYlLabel + ' 工单排产=' + b.bodyHasYlLabel +
  ' 快速排产=' + c.bodyHasYlLabel + ' 工序进度看板=' + d.bodyHasYlLabel)
