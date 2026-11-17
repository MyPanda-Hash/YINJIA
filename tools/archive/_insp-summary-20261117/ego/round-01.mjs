// 样品检验汇总表(INSP_SUMMARY)界面取证 round-01
// 1) 5173 源码版:本月区间 → 按送样人 / 按委托单 / 展开明细 / 导出 Excel
// 2) 8090 打包版:同一页面截图(确认 jar 内 static 已更新)
// 3) English 走查:标题/列头/按钮无中文残留
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const LOGIN = async (page) => {
  const inputs = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.placeholder || ''))
  if (!inputs.some((p) => p.includes('账号'))) return false
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
  await page.waitForTimeout(3500)
  return true
}
const shot = async (task, page, name) => {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
}
const clickText = async (page, selector, text) => page.evaluate(([sel, t]) => {
  const el = [...document.querySelectorAll(sel)].find((n) => (n.textContent || '').replace(/\s+/g, '').includes(t))
  if (!el) return false
  el.click()
  return true
}, [selector, text])

const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
const out = {}

await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3000)
if (await LOGIN(page)) {
  await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 })
  await page.waitForTimeout(3000)
}
// 默认本周(2026-11-16 起)不含 11-15 的单 ⇒ 切「本月」把样本单据带出来
await clickText(page, '.el-radio-button', '本月')
await page.waitForTimeout(2500)

out.src = await page.evaluate(() => ({
  hash: location.hash,
  title: document.querySelector('.iss-title')?.textContent?.trim(),
  stats: [...document.querySelectorAll('.iss-stat')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  tabs: [...document.querySelectorAll('.iss-tabs .el-tabs__item')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  senderRows: [...document.querySelectorAll('.iss-tabs .el-tab-pane:nth-child(1) .el-table__body-wrapper tbody tr')].length,
  firstRow: document.querySelector('.iss-tabs .el-tab-pane:nth-child(1) .el-table__body-wrapper tbody tr')?.textContent?.replace(/\s+/g, ' ').trim(),
}))
await shot(task, page, '01-5173-sender')

// 按委托单/样品
await clickText(page, '.iss-tabs .el-tabs__item', '按委托单')
await page.waitForTimeout(1500)
out.docs = await page.evaluate(() => ({
  rows: [...document.querySelectorAll('.iss-tabs .el-tab-pane')].map((p) => p.querySelectorAll('.el-table__body-wrapper tbody tr').length),
  firstRow: [...document.querySelectorAll('.iss-tabs .el-tab-pane')][1]?.querySelector('.el-table__body-wrapper tbody tr')?.textContent?.replace(/\s+/g, ' ').trim(),
}))
await shot(task, page, '02-5173-docs')

// 展开第一张单看检测项目明细
await page.evaluate(() => {
  const pane = [...document.querySelectorAll('.iss-tabs .el-tab-pane')][1]
  const icon = pane?.querySelector('.el-table__body-wrapper .el-table__expand-icon')
  icon?.click()
})
await page.waitForTimeout(1200)
out.expand = await page.evaluate(() => {
  const pane = [...document.querySelectorAll('.iss-tabs .el-tab-pane')][1]
  const sub = pane?.querySelector('.iss-expand')
  return { text: (sub?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400) }
})
await shot(task, page, '03-5173-expand')

// 导出 Excel:落盘到浏览器默认下载目录,脚本侧核对文件
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('导出 Excel'))
  btn?.click()
})
await page.waitForTimeout(4000)
const fs = await import('node:fs/promises')
let downloads = []
try {
  const dir = 'C:/Users/vigna/Downloads'
  const files = await fs.readdir(dir)
  for (const f of files.filter((x) => x.includes('样品检验汇总表') && x.endsWith('.xlsx'))) {
    const st = await fs.stat(`${dir}/${f}`)
    downloads.push({ f, mtime: st.mtimeMs, size: st.size })
  }
  downloads.sort((a, b) => b.mtime - a.mtime)
  downloads = downloads.slice(0, 3)
} catch (e) { downloads = [{ error: e.message }] }
out.export = downloads

// 8090 打包版(独立 origin:可能要重新登录)
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3000)
if (await LOGIN(page)) {
  await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
  await page.waitForTimeout(3500)
}
await clickText(page, '.el-radio-button', '本月')
await page.waitForTimeout(2500)
out.jar = await page.evaluate(() => ({
  hash: location.hash,
  title: document.querySelector('.iss-title')?.textContent?.trim(),
  stats: [...document.querySelectorAll('.iss-stat')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
}))
await shot(task, page, '04-8090-jar')

// English 走查(只改本 origin 的 locale 偏好,看完还原中文)
const zh = await page.evaluate(() => localStorage.getItem('mes_locale'))
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload()
await page.waitForTimeout(4000)
await clickText(page, '.el-radio-button', 'This month')
await page.waitForTimeout(2500)
out.en = await page.evaluate(() => ({
  hash: location.hash,
  title: document.querySelector('.iss-title')?.textContent?.trim(),
  tabs: [...document.querySelectorAll('.iss-tabs .el-tabs__item')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  headers: [...document.querySelectorAll('.iss-tabs .el-table__header-wrapper th')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 12),
  buttons: [...document.querySelectorAll('.iss-controls button')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  statLabels: [...document.querySelectorAll('.iss-stat em')].map((n) => (n.textContent || '').trim()),
}))
await shot(task, page, '05-en')
await page.evaluate((v) => localStorage.setItem('mes_locale', v || 'zh-CN'), zh)
await page.reload()
await page.waitForTimeout(2500)

console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: [] })
