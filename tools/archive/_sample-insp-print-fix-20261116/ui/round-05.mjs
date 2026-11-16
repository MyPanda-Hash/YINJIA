/* round-05:登录测库 → 新增 → 导出→打印预览(应走原生打印) → 打印态 PDF */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-print-fix-20261116/'
const task = await taskSpace(5)
const page = (await task.pages())[0]
// 登录工厂 = 测试库
await page.click('.el-select--large .el-select__wrapper')
await page.waitForTimeout(800)
const picked = await page.evaluate(() => {
  const hit = [...document.querySelectorAll('.el-select-dropdown__item')].find((e) => (e.textContent || '').includes('测试'))
  if (hit) { hit.click(); return true }
  return false
})
console.log('pick 测试库:', picked)
await page.waitForTimeout(700)
await page.fill('input[placeholder="请输入登录账号"]', 'admin')
await page.fill('input[placeholder="请输入登录密码"]', '123456')
await page.click('button.login-submit')
await page.waitForTimeout(6500)
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(6000)
let st = await page.evaluate(() => ({ hash: location.hash, factory: (document.querySelector('.el-select--large')?.textContent || '').trim(), docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length, side: [...document.querySelectorAll('.as-side-btn')].map((b) => (b.textContent || '').trim()) }))
console.log('panel state:', JSON.stringify(st))
if (!st.inputs) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '新增'); b && b.click() })
  await page.waitForTimeout(5000)
  st = await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))
  console.log('after 新增:', JSON.stringify(st))
}
// 拦截 window.print
await page.evaluate(() => { window.__printCalled = 0; window.print = () => { window.__printCalled++ } })
// 导出 → 打印预览
await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '导出'); b && b.click() })
await page.waitForTimeout(1200)
const pre = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth)
  if (!d) return { err: 'no dialog' }
  const hit = [...d.querySelectorAll('*')].find((e) => (e.textContent || '').trim() === '打印预览' && !e.children.length)
  if (!hit) return { err: 'no 打印预览' }
  hit.click(); return { ok: true }
})
console.log('click 打印预览:', JSON.stringify(pre))
await page.waitForTimeout(3500)
const after = await page.evaluate(() => ({
  printCalled: window.__printCalled,
  host: !!document.getElementById('yj-print-host'),
  bodyClass: document.body.classList.contains('approval-printing'),
  pageStyle: !!document.getElementById('ic-print-page'),
  printZoom: document.documentElement.style.getPropertyValue('--print-zoom'),
  docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(),
}))
console.log('after 打印预览(期望 printCalled=1、host=false):', JSON.stringify(after))
// 手工回到打印态,量行高/按钮显隐 + printToPDF
await page.evaluate(() => {
  document.body.classList.add('approval-printing')
  if (!document.getElementById('ic-print-page')) {
    const s = document.createElement('style'); s.id = 'ic-print-page'
    s.textContent = '@page { size: A4 portrait; margin: 8mm; }'
    document.head.appendChild(s)
  }
})
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(900)
const styles = await page.evaluate(() => {
  const cs = (sel) => { const e = document.querySelector(sel); if (!e) return null; const c = getComputedStyle(e); return { fs: c.fontSize, lh: c.lineHeight, disp: c.display } }
  const b = document.querySelector('.ic-pick-btn')
  return {
    btn: b ? { disp: getComputedStyle(b).display, w: b.offsetWidth, noPrint: b.classList.contains('no-print') } : 'removed',
    td: cs('.ic-grid td'),
    opt: cs('.ic-handle-cell .ic-opt'),
    noteText: cs('.ic-note-text'),
    datePick: cs('.ic-date-pick'),
    dateText: cs('.ic-date-text'),
  }
})
console.log('print styles:', JSON.stringify(styles, null, 2))
try {
  const pdf = await page.cdp('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.315, marginBottom: 0.315, marginLeft: 0.315, marginRight: 0.315 })
  await fs.writeFile(OUT + 'native-print.pdf', Buffer.from(pdf.data, 'base64'))
  console.log('PDF OK')
} catch (e) { console.log('PDF FAIL', e.message.slice(0, 120)) }
await page.evaluate(() => { document.body.classList.remove('approval-printing'); document.getElementById('ic-print-page')?.remove() })
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
