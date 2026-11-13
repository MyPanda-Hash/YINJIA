// round-10：排单计划纸表「订单数量」列 —— 在 5173 源码版页面里真实调用 schedPlanSheetHtml 渲染并截图
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
await page.goto('http://localhost:5173/', { timeout: 30000 })
await page.waitForTimeout(2500)

const result = await page.evaluate(async () => {
  const mod = await import('/src/business/print-formats.js')
  const rows = [{
    客户等级: '甲', 客户: '张莉', 加工单号: 'GD-2026-11-0012', 工单行号: 1, 公司代码: '0',
    物料编码: 'A-32-01', 规格型号: '40.5*16*80', 生产线: '切炭(自动)', 生产车间: '切炭',
    未交量: 5, 需求数量: 200, 排产数量: 5, 当前工序完工量: 0,
    交期: '2026-11-16', 交期紧迫度: 3, '7天已排': 5, '15天已排': 5, '大于15天已排': 0,
    日计划: { '2026-11-13': 2, '2026-11-14': 2, '2026-11-15': 1 },
  }]
  const html = await mod.schedPlanSheetHtml(rows, ['2026-11-13', '2026-11-14', '2026-11-15'],
    { today: '2026-11-13', shop: '切炭' })
  return { html, hasHeader: html.includes('>订单数量</th>'), title: html.includes('切炭车间排单计划') }
})
console.log('标题含切炭车间排单计划=' + result.title + ' 含订单数量表头=' + result.hasHeader + ' html长度=' + result.html.length)
// 订单数量列的值(200)与列顺序
const idxDone = result.html.indexOf('>未完成<br>总数</th>')
const idxOrder = result.html.indexOf('>订单数量</th>')
const idxPlan = result.html.indexOf('>生产计划<br>数量</th>')
console.log('列顺序 未完成<订单数量<生产计划=' + (idxDone >= 0 && idxDone < idxOrder && idxOrder < idxPlan))
const fs = await import('node:fs/promises')
await fs.writeFile('C:/Users/vigna/ego/wo-create-20261113/plan-sheet-切炭.html', result.html, 'utf8')
// 在第二个 page 里渲染这张纸表并截图(A4 横向)
const p2 = await t.newPage()
await p2.goto('data:text/html;charset=utf-8,' + encodeURIComponent(result.html), { timeout: 20000 })
await p2.waitForTimeout(1200)
const check = await p2.evaluate(() => ({
  headers: [...document.querySelectorAll('th')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
  orderCell: [...document.querySelectorAll('td')].map((x) => (x.textContent || '').trim()).find((v) => v === '200') || '',
}))
console.log('纸表头=' + JSON.stringify(check.headers))
console.log('含值200=' + !!check.orderCell)
await p2.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r10-plan-sheet.png', fullPage: true })
console.log('pageerrors=' + JSON.stringify(errors))
console.log('shot=C:/Users/vigna/ego/wo-create-20261113/r10-plan-sheet.png')
