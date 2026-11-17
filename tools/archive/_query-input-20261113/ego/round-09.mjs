// round-09:抓请求体验证三种查询路径(编码片段/名称片段/选中候选/清空)
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5174/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
await page.waitForTimeout(9000)

// XHR hook(axios 走 XHR):记录 queryFormDataList 的请求体
await page.evaluate(() => {
  window.__REQ = []
  if (!window.__xhrHooked) {
    window.__xhrHooked = true
    const origOpen = XMLHttpRequest.prototype.open
    const origSend = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__u = String(u); return origOpen.call(this, m, u, ...rest) }
    XMLHttpRequest.prototype.send = function (body) {
      try {
        if (String(this.__u || '').includes('queryFormDataList') && body) {
          const b = JSON.parse(body)
          window.__REQ.push({ panel: b.panelCode, condition: b.condition, keyword: b.keyword })
        }
      } catch (e) { /* ignore */ }
      return origSend.call(this, body)
    }
  }
})

await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.fields.udl-fields .field')]
  const target = fields.find((f) => (f.querySelector('label')?.textContent || '').trim() === '产品编码')
  const inp = target ? target.querySelector('input') : null
  if (inp) inp.setAttribute('data-qi', 'product-code')
  const ths = [...document.querySelectorAll('.el-table__header-wrapper th')].map((th) => (th.innerText || '').replace(/\s+/g, '').replace('⇅', ''))
  window.__CODE_COL = ths.findIndex((t) => t === '产品编码')
})

const read = () => page.evaluate(() => {
  const col = window.__CODE_COL
  const codes = [...document.querySelectorAll('.el-table__body tbody tr')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    return tds[col] ? (tds[col].innerText || '').trim() : '?'
  })
  const mainReqs = (window.__REQ || []).filter((r) => r.panel === 'WO_REPORT_LIST')
  const invReqs = (window.__REQ || []).filter((r) => r.panel === 'INV')
  return {
    lastMain: mainReqs.slice(-1),
    mainCount: mainReqs.length,
    invCount: invReqs.length,
    input: document.querySelector('[data-qi="product-code"]')?.value,
    rows: document.querySelectorAll('.el-table__body tbody tr').length,
    pageText: (document.querySelector('.page-no')?.textContent || '').trim(),
    totalText: (document.querySelector('.report-count')?.textContent || '').trim(),
    codeCol: window.__CODE_COL,
    sample: codes.slice(0, 6),
    distinct: [...new Set(codes)].length,
  }
})

// ① 编码片段
await page.click('[data-qi="product-code"]')
await page.waitForTimeout(400)
await page.fill('[data-qi="product-code"]', 'A-48')
await page.waitForTimeout(1500)
await page.keyboard.press('Enter')
await page.waitForTimeout(4000)
console.log('CASE1 ' + JSON.stringify(await read(), null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-09-case1.png' })

// ② 名称片段
await page.fill('[data-qi="product-code"]', '')
await page.waitForTimeout(500)
await page.fill('[data-qi="product-code"]', '炭棒')
await page.waitForTimeout(1800)
await page.keyboard.press('Enter')
await page.waitForTimeout(5000)
console.log('CASE2 ' + JSON.stringify(await read(), null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-09-case2.png' })

// ③ 选中候选(输入 阻垢棒 后点第一项)
await page.fill('[data-qi="product-code"]', '')
await page.waitForTimeout(500)
await page.fill('[data-qi="product-code"]', '阻垢棒')
await page.waitForTimeout(2000)
const clicked = await page.evaluate(() => {
  const li = document.querySelector('.el-autocomplete-suggestion li')
  if (!li) return null
  const txt = (li.textContent || '').replace(/\s+/g, ' ').trim()
  li.click()
  return txt
})
await page.waitForTimeout(4000)
console.log('CASE3_PICKED ' + JSON.stringify(clicked))
console.log('CASE3 ' + JSON.stringify(await read(), null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-09-case3.png' })

// ④ 清空
const cleared = await page.evaluate(() => {
  const f = document.querySelector('[data-qi="product-code"]')?.closest('.field')
  const btn = f ? f.querySelector('.el-input__clear, .el-input__icon.el-input__clear') : null
  if (btn) { btn.click(); return 'clicked-clear-icon' }
  return 'no-clear-icon'
})
await page.waitForTimeout(3500)
console.log('CASE4_CLEAR ' + cleared + ' ' + JSON.stringify(await read(), null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-09-case4.png' })
console.log('DONE round-09')
