/* round-01.mjs — 检验数据记录:新增一张 → 侦察纸面/物料编码参照控件/带入按钮 */
const task = await taskSpace('qc-carry-20261112')
console.log('space=' + task.spaceId)

const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 60000 })
await page.waitForTimeout(8000)

const state0 = await page.evaluate(() => ({
  hash: location.hash,
  isLogin: !!document.querySelector('input[placeholder*="账号"]'),
  title: (document.querySelector('.qr-title, .cs-title, h1, h2') || {}).innerText || '',
  hasSheet: !!document.querySelector('.qr-table, table'),
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
}))
console.log('state0=' + JSON.stringify(state0, null, 2))
if (state0.isLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
    if (b) b.click()
  })
  await page.waitForTimeout(7000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 60000 })
  await page.waitForTimeout(7000)
}

// 点「新增」
const added = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.tools span, .tools button, .el-button')]
  const b = btns.find((x) => ['新增', '新增流程'].includes((x.textContent || '').trim()))
  if (!b) return 'no-btn'
  b.click()
  return 'clicked'
})
console.log('新增 ->', added)
await page.waitForTimeout(5000)

const after = await page.evaluate(() => {
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
  const m = txt.match(/单据[：:]\s*([A-Z]+-[0-9-]+)/)
  const refCells = [...document.querySelectorAll('.qr-ref-ctl')].map((el) => ({
    text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
    title: el.getAttribute('title') || '',
  }))
  const inputs = [...document.querySelectorAll('.qr-table input, .qr-cell-input input, .qr-cell-input')].length
  return {
    docNo: m ? m[1] : '',
    refCells,
    inputCount: inputs,
    carryBtn: [...document.querySelectorAll('.qr-lib-btn')].map((el) => (el.innerText || '').trim()),
    headText: txt.slice(0, 420),
  }
})
console.log('after add ->', JSON.stringify(after, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-carry-20261112/round-01.png' })
