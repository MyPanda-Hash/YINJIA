// round-14:8090 最终验收(刷新后应无历史错误横幅) + 截图留存
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
await page.waitForTimeout(8000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const st = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.fields.udl-fields .field')]
  const target = fields.find((f) => (f.querySelector('label')?.textContent || '').trim() === '产品编码')
  if (target) target.querySelector('input')?.setAttribute('data-qi', 'product-code')
  return {
    hash: location.hash,
    banner: (document.body.innerText || '').includes('页面脚本异常'),
    fields: fields.length,
    autocomplete: !!(target && target.querySelector('.el-autocomplete')),
    placeholder: target?.querySelector('input')?.placeholder || '',
    magnifier: target ? [...target.querySelectorAll('button')].map((b) => b.title).filter(Boolean) : [],
    rows: document.querySelectorAll('.el-table__body tbody tr').length,
    total: (document.querySelector('.report-count')?.textContent || '').trim(),
  }
})
console.log('FINAL ' + JSON.stringify(st, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-14-final.png' })

// 名称片段回车(最终演示:输入「炭棒」)
await page.click('[data-qi="product-code"]')
await page.waitForTimeout(300)
await page.fill('[data-qi="product-code"]', '炭棒')
await page.waitForTimeout(1800)
const sug = await page.evaluate(() => [...document.querySelectorAll('.el-autocomplete-suggestion li')].slice(0, 5).map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-14-suggest.png' })
await page.keyboard.press('Enter')
await page.waitForTimeout(5000)
const after = await page.evaluate(() => ({
  suggestions: null,
  input: document.querySelector('[data-qi="product-code"]')?.value,
  rows: document.querySelectorAll('.el-table__body tbody tr').length,
  total: (document.querySelector('.report-count')?.textContent || '').trim(),
  pageText: (document.querySelector('.page-no')?.textContent || '').trim(),
}))
console.log('SUGGESTIONS ' + JSON.stringify(sug))
console.log('AFTER_NAME_FRAGMENT ' + JSON.stringify(after, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-14-name-search.png' })
console.log('DONE round-14')
