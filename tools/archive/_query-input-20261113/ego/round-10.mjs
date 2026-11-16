// round-10:精简输出 —— 复核 CASE1(编码片段) 与 CASE2(名称片段) 的实际请求条件
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5174/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
await page.waitForTimeout(9000)

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
  const fields = [...document.querySelectorAll('.fields.udl-fields .field')]
  const target = fields.find((f) => (f.querySelector('label')?.textContent || '').trim() === '产品编码')
  const inp = target ? target.querySelector('input') : null
  if (inp) inp.setAttribute('data-qi', 'product-code')
  const ths = [...document.querySelectorAll('.el-table__header-wrapper th')].map((th) => (th.innerText || '').replace(/\s+/g, '').replace('⇅', ''))
  window.__CODE_COL = ths.findIndex((t) => t === '产品编码')
})

const summarize = (cond) => {
  if (!cond) return null
  const out = {}
  for (const [k, v] of Object.entries(cond)) {
    if (Array.isArray(v)) out[k] = { type: 'array', len: v.length, head: v.slice(0, 3) }
    else out[k] = { type: typeof v, value: String(v).slice(0, 40) }
  }
  return out
}

const run = async (label, text, waitSug = 1800, pressEnter = true) => {
  await page.fill('[data-qi="product-code"]', '')
  await page.waitForTimeout(400)
  await page.click('[data-qi="product-code"]')
  await page.waitForTimeout(200)
  await page.fill('[data-qi="product-code"]', text)
  await page.waitForTimeout(waitSug)
  if (pressEnter) await page.keyboard.press('Enter')
  await page.waitForTimeout(4500)
  const st = await page.evaluate((typed) => {
    const col = window.__CODE_COL
    const codes = [...document.querySelectorAll('.el-table__body tbody tr')].map((tr) => {
      const tds = [...tr.querySelectorAll('td')]
      return tds[col] ? (tds[col].innerText || '').trim() : '?'
    })
    const main = (window.__REQ || []).filter((r) => r.panel === 'WO_REPORT_LIST')
    return {
      last: main.slice(-1)[0] || null,
      input: document.querySelector('[data-qi="product-code"]')?.value,
      rows: document.querySelectorAll('.el-table__body tbody tr').length,
      pageText: (document.querySelector('.page-no')?.textContent || '').trim(),
      totalText: (document.querySelector('.report-count')?.textContent || '').trim(),
      sample: codes.slice(0, 5),
      allMatchPrefix: typed.startsWith('A-48') ? codes.every((c) => c.startsWith('A-48')) : null,
    }
  }, text)
  console.log(label + ' ' + JSON.stringify({ condition: summarize(st.last?.condition), keyword: st.last?.keyword, input: st.input, totalText: st.totalText, rows: st.rows, sample: st.sample, allMatchPrefix: st.allMatchPrefix }, null, 2))
  return st
}

await run('CASE1_A48', 'A-48')
await run('CASE2_炭棒', '炭棒')
await run('CASE3_ZZB', '阻垢棒')
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-10.png' })
console.log('DONE round-10')
