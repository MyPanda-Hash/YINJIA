/**
 * round-03:验证**打包版(8090)**跑的是合并后的新后端 + 新前端。
 *
 * 关键点:新后端 MixScanService 改读《混料物料清单》bs_mix_bom(本地正式库是空表),
 * 所以同样的工单行应该表现为「明细为空 + 空态提示」,扫料应被拒并给出应投编码列表
 * —— 若还是旧口径(mate),这里会带出 6 行 BOM,即说明 8090 还是旧包。
 */
const task = await taskSpace('mix-scale-only-20261119')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/mix-scale-only-20261119'

await page.goto('http://127.0.0.1:8090/', { timeout: 60000 })
await page.waitForTimeout(3500)

const login = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (login) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
}

await page.evaluate(() => { location.hash = '#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0007&line=5' })
await page.waitForTimeout(5000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const probe = () => page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '')
  return {
    hash: location.hash,
    ledger: (document.body.innerText.match(/YINJIA-MES[^\s]*/) || [''])[0],
    rows: [...document.querySelectorAll('.mp-line')].map((el) => txt(el.querySelector('.mp-line-name'))),
    empty: txt(document.querySelector('.mp-empty')),
    qtyInputs: document.querySelectorAll('.mp-qty input').length,
    err: txt(document.querySelector('.mp-err')),
    ok: txt(document.querySelector('.mp-ok')),
    scaleCard: txt(document.querySelector('.mp-scale')),
  }
})

console.log('--- 8090 打包版 · 打开混料明细 ---')
console.log(JSON.stringify(await probe(), null, 2))
await page.screenshot({ path: `${OUT}/round-03a-8090-empty.png` })

// 扫一个旧口径里"有"的物料:新后端应拒绝(本地 bs_mix_bom 没维护)
await page.evaluate(() => {
  const input = [...document.querySelectorAll('.mp-row input')].find((i) => (i.placeholder || '').includes('物料码'))
  if (!input) return 'no-input'
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  input.focus(); set.call(input, 'AGC-80250')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'ok'
})
await page.waitForTimeout(300)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '查询')
  if (btn) btn.click()
})
await page.waitForTimeout(2500)

console.log('--- 扫料结果(新后端按 bs_mix_bom 校验)---')
console.log(JSON.stringify(await probe(), null, 2))
await page.screenshot({ path: `${OUT}/round-03b-8090-reject.png` })

await task.finish({ keep: [] })
