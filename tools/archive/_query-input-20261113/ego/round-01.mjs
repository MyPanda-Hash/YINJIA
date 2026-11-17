// round-01:登录并打开「报工记录」面板,侦察查询区「产品编码」控件的当前形态(只读侦察,不改数据)
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 60000 })
await page.waitForTimeout(4000)

let state = await page.evaluate(() => ({
  hash: location.hash,
  login: [...document.querySelectorAll('input')].map((i) => i.placeholder || i.type),
  bodyText: (document.body.innerText || '').slice(0, 400),
}))
console.log('STATE1 ' + JSON.stringify(state, null, 2))

// 若落在登录页:填 admin/123456,登录工厂保持默认(应为正式库),点进入系统
if (state.login.some((p) => String(p).includes('账号'))) {
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
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(5000)
  await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 60000 })
  await page.waitForTimeout(5000)
}

// 恢复窗口再截图(最小化时截不了)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const info = await page.evaluate(() => {
  const qf = document.querySelector('.fields.udl-fields')
  const fields = qf ? [...qf.querySelectorAll('.field')].map((f) => {
    const label = (f.querySelector('label')?.textContent || '').trim()
    const inputs = [...f.querySelectorAll('input')].map((i) => ({
      value: i.value,
      placeholder: i.placeholder,
      readonly: i.readOnly,
      cls: i.className,
      role: i.getAttribute('role') || '',
    }))
    const buttons = [...f.querySelectorAll('button')].map((b) => (b.title || b.textContent || '').trim())
    return { label, inputs, buttons }
  }) : []
  return {
    hash: location.hash,
    panel: document.querySelector('.doc-chip')?.textContent?.trim() || '',
    fieldCount: fields.length,
    fields,
    rows: document.querySelectorAll('.el-table__body tbody tr').length,
  }
})
console.log('INFO ' + JSON.stringify(info, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-01.png' })
console.log('DONE round-01')
