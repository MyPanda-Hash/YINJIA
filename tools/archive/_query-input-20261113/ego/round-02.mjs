// round-02:登录(5174→8092 新后端) + 打开报工记录 + 侦察查询区「产品编码」控件形态
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5174/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
await page.waitForTimeout(5000)

let st = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  inputs: [...document.querySelectorAll('input')].map((i) => i.placeholder || i.type),
  text: (document.body.innerText || '').slice(0, 300),
}))
console.log('STATE1 ' + JSON.stringify(st))

if (st.inputs.some((p) => String(p).includes('账号'))) {
  // 登录:账号/密码 + 登录工厂(默认通常是 YINJIA-MES=正式库;这里显式读一下当前值)
  const factory = await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
    return { txt: txt.slice(0, 500) }
  })
  console.log('LOGINPAGE ' + JSON.stringify(factory))
  await page.waitForTimeout(500)
  // 「登录工厂」下拉:点开取第一项(YINJIA-MES 正式库)
  const opened = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.el-select, input')].find((x) => (x.closest('.el-select') || x).textContent?.includes('YINJIA'))
    if (el) { el.click?.(); return 'clicked' }
    return 'no-factory-select'
  })
  console.log('FACTORY ' + opened)
  await page.waitForTimeout(800)
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const target = items.find((i) => (i.textContent || '').includes('YINJIA-MES') && !(i.textContent || '').includes('测试'))
    const name = target ? target.textContent.trim() : ''
    if (target) target.click()
    return { count: items.length, picked: name, all: items.map((i) => i.textContent.trim()).slice(0, 6) }
  })
  console.log('PICK ' + JSON.stringify(picked))
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  await page.goto('http://localhost:5174/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
  await page.waitForTimeout(6000)
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

// 记录查询请求(后续轮次触发查询时能看到实际 condition)
await page.evaluate(() => {
  window.__QREQ = []
  if (!window.__fetchHooked) {
    window.__fetchHooked = true
    const orig = window.fetch
    window.fetch = async (input, init) => {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || ''
        if (url.includes('/px/queryFormDataList') && init && init.body) {
          const body = JSON.parse(init.body)
          window.__QREQ.push({ t: Date.now(), panel: body.panelCode, condition: body.condition, keyword: body.keyword })
        }
      } catch (e) { /* ignore */ }
      return orig(input, init)
    }
  }
})

const info = await page.evaluate(() => {
  const qf = document.querySelector('.fields.udl-fields')
  const fields = qf ? [...qf.querySelectorAll('.field')].map((f) => {
    const label = (f.querySelector('label')?.textContent || '').trim()
    const inputs = [...f.querySelectorAll('input')].map((i) => ({
      value: i.value, placeholder: i.placeholder, readonly: i.readOnly,
      cls: String(i.className).slice(0, 80),
    }))
    const buttons = [...f.querySelectorAll('button')].map((b) => (b.title || b.textContent || '').trim())
    const autocomplete = !!f.querySelector('.el-autocomplete')
    return { label, autocomplete, inputs, buttons }
  }) : []
  return {
    hash: location.hash,
    panel: document.querySelector('.doc-chip')?.textContent?.trim() || '',
    fieldCount: fields.length,
    fields,
    rows: document.querySelectorAll('.el-table__body tbody tr').length,
    total: document.querySelector('.report-count')?.textContent?.trim() || document.querySelector('.page-no')?.textContent?.trim() || '',
  }
})
console.log('INFO ' + JSON.stringify(info, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-02.png' })
console.log('DONE round-02')
