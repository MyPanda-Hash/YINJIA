// round-08:5174(新后端 8092) 真机验证「产品编码」输入即查
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5174/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
await page.waitForTimeout(9000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

// 抓查询请求
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
          window.__QREQ.push({ condition: b.condition, keyword: b.keyword })
        }
      } catch (e) { /* ignore */ }
      return orig(input, init)
    }
  }
})

// 侦察查询区:产品编码控件形态 + 打标记
const probe = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.fields.udl-fields .field')]
  const info = fields.map((f) => {
    const label = (f.querySelector('label')?.textContent || '').trim()
    const input = f.querySelector('input')
    return {
      label,
      autocomplete: !!f.querySelector('.el-autocomplete'),
      placeholder: input ? input.placeholder : '',
      readonly: input ? input.readOnly : null,
      buttons: [...f.querySelectorAll('button')].map((b) => (b.title || '').trim()).filter(Boolean),
    }
  })
  const target = fields.find((f) => (f.querySelector('label')?.textContent || '').trim() === '产品编码')
  const inp = target ? target.querySelector('input') : null
  if (inp) inp.setAttribute('data-qi', 'product-code')
  // 表头列索引
  const ths = [...document.querySelectorAll('.el-table__header-wrapper th')].map((th) => (th.innerText || '').trim())
  window.__CODE_COL = ths.findIndex((t) => t === '产品编码')
  return { info, codeCol: window.__CODE_COL, ths, rows: document.querySelectorAll('.el-table__body tbody tr').length }
})
console.log('PROBE ' + JSON.stringify(probe, null, 2))

const readState = () => page.evaluate(() => {
  const codes = [...document.querySelectorAll('.el-table__body tbody tr')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    return tds[window.__CODE_COL] ? (tds[window.__CODE_COL].innerText || '').trim() : ''
  })
  return {
    reqs: (window.__QREQ || []).slice(-1),
    input: document.querySelector('[data-qi="product-code"]')?.value,
    tableRows: document.querySelectorAll('.el-table__body tbody tr').length,
    pageText: (document.querySelector('.page-no')?.textContent || '').trim(),
    totalText: (document.querySelector('.report-count')?.textContent || '').trim(),
    sampleCodes: [...new Set(codes)].slice(0, 8),
  }
})

// ① 输入编码片段 A-48,等联想,回车
await page.click('[data-qi="product-code"]')
await page.waitForTimeout(400)
await page.fill('[data-qi="product-code"]', 'A-48')
await page.waitForTimeout(1500)
const sug = await page.evaluate(() => [...document.querySelectorAll('.el-autocomplete-suggestion li')]
  .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 10))
console.log('SUGGESTIONS ' + JSON.stringify(sug))
await page.keyboard.press('Enter')
await page.waitForTimeout(4000)
console.log('CASE1_CODE_FRAGMENT ' + JSON.stringify(await readState(), null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-08-case1-code-fragment.png' })

// ② 名称片段「炭棒」回车(应走编码数组 IN)
await page.click('[data-qi="product-code"]')
await page.waitForTimeout(300)
await page.fill('[data-qi="product-code"]', '炭棒')
await page.waitForTimeout(1800)
const sug2 = await page.evaluate(() => [...document.querySelectorAll('.el-autocomplete-suggestion li')]
  .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 10))
console.log('SUGGESTIONS2 ' + JSON.stringify(sug2))
await page.keyboard.press('Enter')
await page.waitForTimeout(5000)
console.log('CASE2_NAME_FRAGMENT ' + JSON.stringify(await readState(), null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-08-case2-name-fragment.png' })
console.log('DONE round-08')
