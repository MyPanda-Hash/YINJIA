// 检验委托单 · 「选择检验项目」弹窗 + 纸面(标准方法检出限改名后)round-02
// 在测试库(YINJIA-MES·测试库)上做:新增草稿 → 弹窗取证 → 勾 2 项 → 带入 → 纸面截图 → 保存 → 清理(删除草稿)
const TASK = 'sample-catalog-rev-20261117'
const OUT = 'D:/workspace/yinjia/tools/archive/_sample-catalog-20261117/ego'
const task = await taskSpace(TASK)
const page = task.page('p1')

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot ->', `${OUT}/${name}.png`)
}
const log = (m, v) => console.log(m, typeof v === 'string' ? v : JSON.stringify(v))

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(4500)
log('hash', await page.evaluate(() => location.hash))
log('login?', await page.evaluate(() => !!document.querySelector('input[placeholder*="密码"]')))

// 弹窗按钮文本定位(纸面里的「选择检验项目…」)
const clickByText = async (sel, text) => page.evaluate(({ sel, text }) => {
  const el = [...document.querySelectorAll(sel)].find((x) => (x.textContent || '').includes(text))
  if (!el) return false
  el.click()
  return true
}, { sel, text })

// 新增(草稿)
const added = await clickByText('button, .el-button', '新增')
log('click 新增 =', added)
await page.waitForTimeout(4000)
await shot('round-02-new-draft')

const hasPick = await page.evaluate(() =>
  [...document.querySelectorAll('button, span, a')].some((x) => (x.textContent || '').trim().startsWith('选择检验项目')))
log('有「选择检验项目」按钮 =', hasPick)
if (!hasPick) {
  log('page text head', await page.evaluate(() => document.body.innerText.slice(0, 600)))
} else {
  await clickByText('button, span, a', '选择检验项目')
  await page.waitForTimeout(4000)
  const dlg = await page.evaluate(() => {
    const box = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('从送样登记表选择检验项目'))
    if (!box) return null
    const ths = [...box.querySelectorAll('th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    const rows = [...box.querySelectorAll('tbody tr')].slice(0, 2).map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
    const count = (box.textContent || '').match(/共\s*(\d+)\s*项/)
    return { ths, rows, count: count ? count[1] : null }
  })
  log('dialog', dlg)
  await shot('round-02-pick-dialog')

  // 勾选前两行(锂/钠)→ 带入
  await page.evaluate(() => {
    const box = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('从送样登记表选择检验项目'))
    const rows = [...box.querySelectorAll('tbody tr')].slice(0, 2)
    rows.forEach((tr) => { const cb = tr.querySelector('input[type=checkbox]'); if (cb) cb.click() })
  })
  await page.waitForTimeout(800)
  await clickByText('.el-dialog button', '带入选中项')
  await page.waitForTimeout(2500)
  const paper = await page.evaluate(() => {
    const sheet = document.querySelector('[data-ic-sheet="INSP_COMMISSION"]')
    if (!sheet) return null
    const ths = [...sheet.querySelectorAll('.ic-items th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim())
    const items = [...sheet.querySelectorAll('.ic-items tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
    const total = (sheet.querySelector('.ic-items-total') || {}).textContent || ''
    return { ths, items, total: total.replace(/\s+/g, ' ').trim() }
  })
  log('paper', paper)
  await shot('round-02-paper')

  // 保存(测试库;保存后读回确认「标准方法检出限」这个数据键真的落库)
  await clickByText('button, .el-button', '保存')
  await page.waitForTimeout(4000)
  const docNo = await page.evaluate(() => {
    const m = document.body.innerText.match(/WT-\d{4}-\d{2}-\d{4}/)
    return m ? m[0] : null
  })
  log('docNo', docNo)
  await shot('round-02-saved')
}
