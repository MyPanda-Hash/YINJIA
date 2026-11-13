// round-05:真机验证「产品编码」查询区 —— 输入片段/回车模糊查/选中候选/清空,并抓请求体
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5174/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
await page.waitForTimeout(7000)

// 抓取查询请求体
await page.evaluate(() => {
  window.__QREQ = []
  const orig = window.fetch
  if (!window.__fetchHooked) {
    window.__fetchHooked = true
    window.fetch = async (input, init) => {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || ''
        if (url.includes('/px/queryFormDataList') && init && init.body) {
          const b = JSON.parse(init.body)
          window.__QREQ.push({ panel: b.panelCode, condition: b.condition, keyword: b.keyword, pageSize: b.pageSize })
        }
      } catch (e) { /* ignore */ }
      return orig(input, init)
    }
  }
})

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

// 侦察查询区字段控件形态,并给「产品编码」输入框打标记
const probe = await page.evaluate(() => {
  const qf = document.querySelector('.fields.udl-fields')
  const fields = qf ? [...qf.querySelectorAll('.field')] : []
  const rows = fields.map((f) => {
    const label = (f.querySelector('label')?.textContent || '').trim()
    const input = f.querySelector('input')
    const isAuto = !!f.querySelector('.el-autocomplete')
    return {
      label,
      autocomplete: isAuto,
      placeholder: input ? input.placeholder : '',
      readonly: input ? input.readOnly : null,
      value: input ? input.value : '',
      buttons: [...f.querySelectorAll('button')].map((b) => (b.title || '').trim()).filter(Boolean),
    }
  })
  const target = fields.find((f) => (f.querySelector('label')?.textContent || '').trim() === '产品编码')
  const targetInput = target ? target.querySelector('input') : null
  if (targetInput) targetInput.setAttribute('data-qi', 'product-code')
  const custInput = (() => {
    const f = fields.find((x) => (x.querySelector('label')?.textContent || '').trim() === '客户编码')
    const i = f ? f.querySelector('input') : null
    if (i) i.setAttribute('data-qi', 'cust-code')
    return !!i
  })()
  return {
    rowsCount: rows.length,
    hasProductCodeInput: !!targetInput,
    hasCustInput: custInput,
    rows,
    tableRows: document.querySelectorAll('.el-table__body tbody tr').length,
    pageText: (document.querySelector('.page-no')?.textContent || '').trim(),
  }
})
console.log('PROBE ' + JSON.stringify(probe, null, 2))

// ① 输入编码片段 A-48 + 回车
await page.click('[data-qi="product-code"]')
await page.waitForTimeout(300)
await page.fill('[data-qi="product-code"]', 'A-48')
await page.waitForTimeout(1200) // 等联想候选(remote 300ms debounce + 请求)
const suggestions = await page.evaluate(() => [...document.querySelectorAll('.el-autocomplete-suggestion li, .el-autocomplete-suggestion__list li')]
  .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8))
console.log('SUGGESTION ' + JSON.stringify(suggestions))
await page.keyboard.press('Enter')
await page.waitForTimeout(3500)
const afterEnter = await page.evaluate(() => ({
  reqs: (window.__QREQ || []).slice(-2),
  input: document.querySelector('[data-qi="product-code"]')?.value,
  tableRows: document.querySelectorAll('.el-table__body tbody tr').length,
  pageText: (document.querySelector('.page-no')?.textContent || '').trim(),
  codes: [...document.querySelectorAll('.el-table__body tbody tr')].slice(0, 6).map((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim())
    return tds[3] || ''
  }),
}))
console.log('AFTER_ENTER ' + JSON.stringify(afterEnter, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-05-a-enter.png' })
console.log('DONE round-05')
