/**
 * round-03.mjs — 2026-11-18 真实点击验证「排单计划」纸表:「未完成总数」→「工序未报工量」。
 *
 * ① 工单排产页点开产线(默认 4号车间,有未完工行)→ 勾第一行 → 点「排单计划」;
 * ② 读打印层 #yj-print-host,断言列头改名 + 逐行 未报工 = 生产计划数量 − 实际完成数量;
 * ③ 纸面 HTML 落盘,交给 round-04 渲染 PNG 看版式。
 *
 * 全部点击走 DOM click(避免 e2e 选择器命中多个/不可点元素)。
 */
import { writeFileSync } from 'node:fs'

const APP = 'http://localhost:5173'
const OUT = 'D:/workspace/yinjia/_scratch/ego-plan-unreported-20261118'
const LINE = '4号车间'
const task = await taskSpace('plan-unreported-20261118')
const page = task.page('p1')

await page.goto(`${APP}/#/`, { timeout: 30000 })
await page.waitForTimeout(2500)

// 工单排产页
await page.goto(`${APP}/#/prod/plan/workOrderBoard`, { timeout: 45000 })
await page.waitForTimeout(9000)

// 选线
const lineHit = await page.evaluate((line) => {
  const cands = [...document.querySelectorAll('.wb-left *')].filter((el) => el.children.length === 0
    && (el.textContent || '').replace(/\s+/g, '') === line)
  if (!cands.length) return 0
  cands[0].click()
  return cands.length
}, LINE)
console.log('产线候选=' + lineHit)
await page.waitForTimeout(8000)

// 勾第一行
const rowInfo = await page.evaluate(() => {
  const trs = [...document.querySelectorAll('.el-table__body tbody tr')]
  const tr = trs[0]
  if (!tr) return null
  const cb = tr.querySelector('.el-checkbox')
  if (cb) cb.click()
  return { rows: trs.length, text: (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300) }
})
console.log('行=' + JSON.stringify(rowInfo, null, 2))
await page.waitForTimeout(1500)

// 打印对话框不阻塞
await page.evaluate(() => { window.print = () => { } })

const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('排单计划')
    && !/设置/.test(x.textContent || ''))
  if (!b) return null
  const disabled = !!b.disabled || b.classList.contains('is-disabled')
  b.click()
  return { text: (b.textContent || '').trim(), disabled }
})
console.log('按钮=' + JSON.stringify(clicked))
await page.waitForTimeout(4500)

const html = await page.evaluate(() => {
  const h = document.getElementById('yj-print-host')
  return h ? h.innerHTML : ''
})
writeFileSync(`${OUT}/plan-5173.html`, html, 'utf8')
console.log('打印层 HTML 长度=' + html.length)

const heads = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ''))
const bodyHtml = (/<tbody>([\s\S]*?)<\/tbody>/.exec(html) || [])[1] || ''
const rows = [...bodyHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
  .map((c) => c[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '')))
console.log('表头=' + JSON.stringify(heads))
const idx = (name) => heads.findIndex((h) => h === name)
const iU = idx('工序未报工量'), iP = idx('生产计划数量'), iD = idx('实际完成数量'), iO = idx('订单数量')
console.log(`列索引:未报工=${iU} 计划=${iP} 完成=${iD} 订单=${iO}`)
for (const [i, cells] of rows.slice(0, 5).entries()) {
  console.log(`行${i + 1}: 订单=${cells[iO]} 计划=${cells[iP]} 完成=${cells[iD]} 未报工=${cells[iU]}`)
}
const bad = rows.filter((cells) => {
  const p = Number(cells[iP] || 0), d = Number(cells[iD] || 0), u = Number(cells[iU] || 0)
  return Math.abs(u - Math.max(0, p - d)) > 0.001
})
console.log((heads.includes('工序未报工量') ? '[PASS]' : '[FAIL]') + ' 列头 = 工序未报工量')
console.log((!html.includes('未完成') ? '[PASS]' : '[FAIL]') + ' 旧列头「未完成总数」已消失')
console.log((iU >= 0 && iU < iP ? '[PASS]' : '[FAIL]') + ' 列位置:工序未报工量 在 生产计划数量 左侧')
console.log((rows.length > 0 && bad.length === 0 ? '[PASS]' : '[FAIL]') + ` 逐行 未报工=计划−完成(${rows.length - bad.length}/${rows.length})`)
if (bad.length) console.log('不符行=' + JSON.stringify(bad.slice(0, 3)))
