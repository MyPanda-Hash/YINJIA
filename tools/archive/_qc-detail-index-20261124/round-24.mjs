// round-24 — 明细表行内「取消完成」:出按钮 → 点它 → 行离开本表 → 回到待检验目录
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc reopen button verify')
const page = task.page('p1')

await page.goto(BASE + '/#/login', { timeout: 180000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.reload({ timeout: 180000 })
await page.waitForTimeout(3000)
await page.fill('.login-form input[autocomplete="username"]', 'admin')
await page.fill('.login-form input[type="password"]', '123456')
const sel = await page.evaluate(() => {
  const el = document.querySelector('.login-form .el-select')
  return el ? el.innerText.replace(/\s+/g, ' ').trim() : ''
})
if (!sel || sel.includes('请选择')) {
  await page.click('.login-form .el-select')
  await page.waitForTimeout(600)
  await page.click('.el-select-dropdown__item')
  await page.waitForTimeout(400)
}
await page.click('.login-submit')
await page.waitForTimeout(7000)
console.log('login: ' + await page.url())

// 等表格出数
async function waitRows(minRows, ms) {
  const end = Date.now() + (ms || 45000)
  while (Date.now() < end) {
    const st = await page.evaluate(() => {
      const t = [...document.querySelectorAll('table')].find((x) => x.querySelectorAll('tbody tr').length > 0)
      return {
        rows: t ? t.querySelectorAll('tbody tr').length : 0,
        ops: document.querySelectorAll('.qc-reopen-na, .doc-no-link').length,
        headers: (() => { const h = [...document.querySelectorAll('table')][0]; return h ? [...h.querySelectorAll('thead th')].map((x) => x.innerText.replace(/[\s⇅]+/g, ' ').trim()) : [] })(),
      }
    })
    if (st.rows >= (minRows || 1)) return st
    await page.waitForTimeout(1200)
  }
  return null
}

await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 180000 })
const st1 = await waitRows(1, 60000)
console.log('① 明细表 = ' + JSON.stringify(st1))
const btns = await page.evaluate(() => [...document.querySelectorAll('td .doc-no-link')]
  .filter((e) => (e.innerText || '').trim() === '取消完成')
  .map((e) => ({ text: e.innerText.trim(), title: e.getAttribute('title') })))
console.log('① 取消完成按钮 = ' + JSON.stringify(btns))
await page.screenshot({ path: OUT + '/round-24-column.png' })

// ② 点第 1 个「取消完成」并确认
const rowInfo = await page.evaluate(() => {
  const el = [...document.querySelectorAll('td .doc-no-link')].find((e) => (e.innerText || '').trim() === '取消完成')
  if (!el) return ''
  const tr = el.closest('tr')
  const txt = tr.innerText.replace(/\s+/g, ' ').slice(0, 90)
  el.click()
  return txt
})
console.log('② 点击行 = ' + rowInfo)
await page.waitForTimeout(1200)
const dlg = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box')
  return box ? box.innerText.replace(/\s+/g, ' ').slice(0, 200) : ''
})
console.log('② 确认框 = ' + dlg)
await page.screenshot({ path: OUT + '/round-24-confirm.png' })
await page.click('.el-message-box__btns .el-button--primary')
await page.waitForTimeout(6000)
const after = await page.evaluate(() => ({
  rows: (() => { const t = [...document.querySelectorAll('table')].find((x) => x.querySelectorAll('tbody tr').length > 0); return t ? t.querySelectorAll('tbody tr').length : 0 })(),
  msg: [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()),
}))
console.log('② 取消完成后 = ' + JSON.stringify(after))
await page.screenshot({ path: OUT + '/round-24-after.png' })

// ③ 待检验目录里应重新看到这行
await page.goto(BASE + '/#/panelx/list/QC_CATALOG', { timeout: 180000 })
await page.waitForTimeout(8000)
const cat = await page.evaluate(() => {
  const txt = document.body.innerText.replace(/\s+/g, ' ')
  return {
    hasRow: txt.includes('气泡袋') && txt.includes('IJ-2026-09-0152'),
    snippet: txt.slice(txt.indexOf('待检验目录'), txt.indexOf('待检验目录') + 500),
  }
})
console.log('③ 待检验目录 = ' + JSON.stringify({ hasRow: cat.hasRow }))
await page.screenshot({ path: OUT + '/round-24-catalog.png' })
