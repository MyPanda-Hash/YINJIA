// round-12: 8090 打包版 + 正式库(HSDZ_MES)—— 只读核对:对话框用量/告警/按钮态(不做任何写入)
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 30000 })
await page.waitForTimeout(6000)

const need = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('登录账号')))
console.log('需要登录 =', need)
if (need) {
  // 登录工厂选「YINJIA-MES」= 正式库(不带「测试库」的那个)
  const fac = await page.evaluate(() => [...document.querySelectorAll('.el-form-item')]
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).find((t) => t.includes('登录工厂')))
  console.log('登录工厂 =', fac)
  if (!fac || !/登录工厂YINJIA-MES\s*$/.test(fac)) {
    await page.evaluate(() => {
      const it = [...document.querySelectorAll('.el-form-item')].find((el) => (el.textContent || '').includes('登录工厂'))
      ;(it?.querySelector('.el-select__wrapper') || it?.querySelector('.el-select'))?.click()
    })
    await page.waitForTimeout(800)
    const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((el) => (el.textContent || '').trim()))
    console.log('工厂选项 =', JSON.stringify(opts))
    await page.evaluate(() => {
      const o = [...document.querySelectorAll('.el-select-dropdown__item')].find((el) => /^YINJIA-MES\s*$/.test((el.textContent || '').trim()))
      if (o) o.click()
    })
    await page.waitForTimeout(600)
  }
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456')
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click())
  await page.waitForTimeout(7000)
}
console.log('账套 =', await page.evaluate(() => (document.querySelector('.factory .factory-name')?.textContent || '').trim()))

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 30000 })
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const n = [...document.querySelectorAll('.qc-insp-sheet *')]
    .find((e) => e.children.length <= 1 && (e.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\w\u4e00-\u9fa5]+/, '') === '自定义字段')
  if (n) n.click()
})
await page.waitForTimeout(4000)
const st = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  if (!d) return { noDialog: true }
  const btn = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
  return {
    summary: (d.querySelector('.fm-summary')?.textContent || '').trim(),
    chips: [...d.querySelectorAll('.fm-tabusage-item')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    alerts: [...d.querySelectorAll('.el-alert__title')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
    addDisabledBeforeFill: btn ? btn.disabled : null,
    rows: [...d.querySelectorAll('.el-table__body tbody tr')].length,
  }
})
console.log('正式库 8090 状态 =', JSON.stringify(st, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-12-prod-8090.png' })
console.log('done round-12')
