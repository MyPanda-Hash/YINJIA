// hide-yl-round-01.mjs — 隐藏「余量」列后三页取证:生产工单 / 工单排产 / 快速排产
const fs = await import('node:fs/promises')
const OUT = 'D:/workspace/yinjia/.tmp/ego/hide-yl'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')

async function ensureLogin() {
  const needLogin = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')))
  if (!needLogin) return false
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
  await page.waitForTimeout(5500)
  return true
}

async function shotAndHeads(url, label, clickLine) {
  await page.goto(url, { timeout: 40000 })
  await page.waitForTimeout(6000)
  const logged = await ensureLogin()
  if (logged) { await page.goto(url, { timeout: 40000 }); await page.waitForTimeout(6000) }
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
  const heads = await page.evaluate(() => [...document.querySelectorAll('.el-table__header th')].map((t) => (t.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  const hasYl = heads.some((h) => h.includes('余量'))
  const rows = await page.evaluate(() => document.querySelectorAll('.el-table__body tbody tr').length)
  console.log(label + ' | 列数=' + heads.length + ' 有"余量"列=' + hasYl + ' 行数=' + rows)
  console.log('  列头: ' + JSON.stringify(heads))
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: OUT + '/' + label + '.png' })
  return hasYl
}

const a = await shotAndHeads('http://localhost:5173/#/prod/plan/workOrderList', 'A-workorder-list')
const b = await shotAndHeads('http://localhost:5173/#/prod/plan/workOrderBoard', 'B-workorder-board', true)
const c = await shotAndHeads('http://localhost:5173/#/prod/plan/scheduleBoard', 'C-schedule-board')
console.log('RESULT 仍有余量列? 生产工单=' + a + ' 工单排产=' + b + ' 快速排产=' + c + ' (应全为 false)')
