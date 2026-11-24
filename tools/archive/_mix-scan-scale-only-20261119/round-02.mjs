/**
 * round-02:验证「扫码混料」明细页的新口径(2026-11-19):
 *   扫物料码解锁后**没有可填的数量框**,数量是电子秤实时读数,核对无误再点「确认」。
 *
 * 造数:测试账套(YJ_TEST)GD-2026-11-0007 行 5(产品 C-95-13,mate BOM 6 行),
 *       物料 AGC-80250(活性炭);电子秤读数由后台循环往 bs_dc_sample 写 12.345kg(模拟秤在上料)。
 * 结束后按 README 清理。
 */
const task = await taskSpace('mix-scale-only-20261119')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/mix-scale-only-20261119'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await page.goto('http://localhost:5173/', { timeout: 60000 })
await page.waitForTimeout(3000)

// 进明细页(未完成模式:wo + line)
await page.evaluate(() => { location.hash = '#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0007&line=5' })
await page.waitForTimeout(5000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const probe = () => page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '')
  const qtyRow = document.querySelector('.mp-qty')
  const btn = (label) => [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === label)
  return {
    hash: location.hash,
    ledger: (document.body.innerText.match(/YINJIA-MES[^\s]*/) || [''])[0],
    rows: [...document.querySelectorAll('.mp-line')].map((el) => txt(el.querySelector('.mp-line-name'))),
    // 关键证据①:数量行里还有没有可编辑控件
    qtyInputs: document.querySelectorAll('.mp-qty input').length,
    qtyNumberWidgets: document.querySelectorAll('.mp-qty .el-input-number').length,
    liveQty: txt(document.querySelector('[data-test="mix-live-qty"]')),
    liveQtyExists: !!document.querySelector('[data-test="mix-live-qty"]'),
    scaleCard: txt(document.querySelector('.mp-scale')),
    takeScaleBtn: !!btn('取秤'),
    confirmDisabled: btn('确认') ? btn('确认').disabled : null,
    qtyTip: txt(document.querySelector('.mp-qty-tip')),
    hint: txt(document.querySelector('.mp-hint')),
    err: txt(document.querySelector('.mp-err')),
    ok: txt(document.querySelector('.mp-ok')),
    progress: txt(document.querySelector('.mp-kv:last-child b')),
  }
})

console.log('--- A. 未解锁(只有扫码框)---')
console.log(JSON.stringify(await probe(), null, 2))
await page.screenshot({ path: `${OUT}/round-02a-locked.png` })

// 扫物料码(A 步:填入 + 点查询)
await page.evaluate(() => {
  const input = [...document.querySelectorAll('.mp-row input')].find((i) => (i.placeholder || '').includes('物料码'))
  if (!input) return 'no-input'
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  input.focus(); set.call(input, 'AGC-80250')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'ok'
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '查询')
  if (btn) btn.click()
})
await page.waitForTimeout(3000)   // 等解锁 + 至少两轮秤轮询(1 秒一抓,连续两次一致才认稳定)

console.log('--- B. 解锁后(数量只读 + 实时秤值)---')
const unlocked = await probe()
console.log(JSON.stringify(unlocked, null, 2))
await page.screenshot({ path: `${OUT}/round-02b-unlocked.png` })

// 再等两轮,证明数字是"跟着秤跳"的活值(不是一次性抓进输入框)
await page.waitForTimeout(2500)
const later = await probe()
console.log('--- C. 2.5s 后再看(读数仍在实时刷新)---')
console.log(JSON.stringify({ liveQty: later.liveQty, scaleCard: later.scaleCard, confirmDisabled: later.confirmDisabled }, null, 2))
await page.screenshot({ path: `${OUT}/round-02c-live.png` })

// 点确认:应把当前秤值写入该行
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '确认')
  if (btn) btn.click()
})
await page.waitForTimeout(3500)

console.log('--- D. 确认之后 ---')
const after = await probe()
console.log(JSON.stringify({
  ok: after.ok,
  rows: after.rows,
  progress: after.progress,
  liveQtyExists: after.liveQtyExists,
  err: after.err,
}, null, 2))
console.log(JSON.stringify(await page.evaluate(() => ({
  lineQtys: [...document.querySelectorAll('.mp-line')].map((el) => (el.querySelector('.mp-line-qty')?.innerText || '').replace(/\s+/g, ' ').trim()),
})), null, 2))
await page.screenshot({ path: `${OUT}/round-02d-confirmed.png` })

await task.finish({ keep: [] })
