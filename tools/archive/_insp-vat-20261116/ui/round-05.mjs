/* round-05:后端重启后 —— 新增→带入6项→核对含税总金额→截图→保存 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/insp-vat-20261116/'
const task = await taskSpace('insp-vat-20261116')
const page = (await task.pages())[0]
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(9000)
let st = await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length, side: [...document.querySelectorAll('.as-side-btn')].map((b) => (b.textContent || '').trim()) }))
console.log('state:', JSON.stringify(st))
if (!st.inputs) {
  const r = await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '新增'); if (!b) return { err: 'no 新增' }; b.click(); return { ok: true } })
  console.log('click 新增:', JSON.stringify(r))
  await page.waitForTimeout(6000)
  st = await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))
  console.log('after 新增:', JSON.stringify(st))
}
if (!st.inputs) { console.log('STILL NO EDITABLE DRAFT'); }
else {
  await page.evaluate(() => { const b = [...document.querySelectorAll('.ic-sheet button')].find((x) => (x.textContent || '').includes('选择检验项目')); b && b.click() })
  await page.waitForTimeout(2500)
  const dlg = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
    return { ok: !!d, rows: d ? d.querySelectorAll('.el-table__body-wrapper tbody tr').length : 0 }
  })
  console.log('catalog:', JSON.stringify(dlg))
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
    if (!d) return
    const rows = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
    rows.slice(0, 6).forEach((r) => { const cb = r.querySelector('.el-checkbox'); cb && cb.click() })
  })
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.innerText || '').includes('从送样登记表选择检验项目'))
    if (!d) return
    const b = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').includes('带入选中项'))
    b && b.click()
  })
  await page.waitForTimeout(1800)
  const info = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.ic-items tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim()))
    const totalEl = document.querySelector('.ic-items-total')
    return { rowCount: rows.length, fees: rows.map((r) => r[6]), totalText: (totalEl?.innerText || '').replace(/\s+/g, ' ').trim() }
  })
  console.log('PAPER:', JSON.stringify(info, null, 2))
  const sum = info.fees.reduce((s, f) => s + Number(f || 0), 0)
  console.log('net =', sum, 'expected total =', (Math.round(sum * 1.06 * 100) / 100).toFixed(2))
  const url = await page.evaluate(async () => {
    const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
    const el = document.querySelector('.ic-sheet')
    return await m.domToPng(el, { scale: 1.3, backgroundColor: '#ffffff', width: el.scrollWidth, height: el.scrollHeight })
  })
  await fs.writeFile(OUT + 'round-05-paper.png', Buffer.from(String(url).split(',')[1], 'base64'))
  console.log('shot round-05-paper.png')
  // 保存
  await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '保存'); b && b.click() })
  await page.waitForTimeout(5000)
  const after = await page.evaluate(() => ({
    docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(),
    toasts: [...document.querySelectorAll('.el-message')].map((e) => e.textContent.trim()),
    boxes: [...document.querySelectorAll('.el-message-box')].filter((e) => e.offsetWidth).map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 120)),
  }))
  console.log('after save:', JSON.stringify(after))
}
