/* round-01:检验委托单总金额含税 6% —— 新增草稿→带入6个项目→核对合计→截图→保存→库值 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/insp-vat-20261116/'
const task = await taskSpace('insp-vat-20261116')
const page = (await task.pages())[0]
console.log('space=' + task.spaceId + ' page=' + page.label)
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(7000)
let st = await page.evaluate(() => ({ hash: location.hash, onLogin: !!document.querySelector('input[placeholder="请输入登录账号"]'), docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))
console.log('state:', JSON.stringify(st))
if (st.onLogin) {
  await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
  await page.reload({ timeout: 90000 }); await page.waitForTimeout(4000)
  await page.click('.el-select--large .el-select__wrapper'); await page.waitForTimeout(800)
  await page.evaluate(() => { const hit = [...document.querySelectorAll('.el-select-dropdown__item')].find((e) => (e.textContent || '').includes('测试')); if (hit) hit.click() })
  await page.waitForTimeout(600)
  await page.fill('input[placeholder="请输入登录账号"]', 'admin')
  await page.fill('input[placeholder="请输入登录密码"]', '123456')
  await page.click('button.login-submit')
  await page.waitForTimeout(6500)
  await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
  await page.waitForTimeout(6000)
}
if (!(await page.evaluate(() => document.querySelectorAll('.ic-sheet input').length))) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '新增'); b && b.click() })
  await page.waitForTimeout(4500)
}
await page.evaluate(() => { const b = [...document.querySelectorAll('.ic-sheet button')].find((x) => (x.textContent || '').includes('选择检验项目')); b && b.click() })
await page.waitForTimeout(2500)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
  return { ok: !!d, rows: d ? d.querySelectorAll('.el-table__body-wrapper tbody tr').length : 0 }
})
console.log('catalog:', JSON.stringify(dlg))
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
  const rows = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  rows.slice(0, 6).forEach((r) => { const cb = r.querySelector('.el-checkbox'); cb && cb.click() })
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
  const b = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').includes('带入选中项'))
  b && b.click()
})
await page.waitForTimeout(1800)
const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.ic-items tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim()))
  const totalEl = document.querySelector('.ic-items-total')
  return {
    rowCount: rows.length,
    fees: rows.map((r) => r[6]),
    totalText: (totalEl?.innerText || '').replace(/\s+/g, ' ').trim(),
  }
})
console.log('PAPER:', JSON.stringify(info, null, 2))
const expect = (Math.round(info.fees.reduce((s, f) => s + Number(f || 0), 0) * 1.06 * 100) / 100).toFixed(2)
console.log('expected total =', expect)
const url = await page.evaluate(async () => {
  const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
  const el = document.querySelector('.ic-sheet')
  return await m.domToPng(el, { scale: 1.3, backgroundColor: '#ffffff', width: el.scrollWidth, height: el.scrollHeight })
})
await fs.writeFile(OUT + 'round-01-paper.png', Buffer.from(String(url).split(',')[1], 'base64'))
console.log('shot round-01-paper.png')
await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '保存'); b && b.click() })
await page.waitForTimeout(4500)
const after = await page.evaluate(() => ({
  docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(),
  toasts: [...document.querySelectorAll('.el-message')].map((e) => e.textContent.trim()),
  boxes: [...document.querySelectorAll('.el-message-box')].filter((e) => e.offsetWidth).map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 120)),
}))
console.log('after save:', JSON.stringify(after))
