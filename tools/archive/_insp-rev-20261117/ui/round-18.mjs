// round-18: 联系人=送样人 下拉验证(默认带当前登录人姓名 + 可选他人 + 保存回读)
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  }
  await T(400)
} catch (e) { console.log('resize skip: ' + e.message) }

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(6500)
const testDb = await page.evaluate(() => document.querySelector('.topbar')?.textContent?.includes('测试库'))
console.log('test-db=' + testDb)

const added = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '新增')
  if (!btn) return 'no-btn'
  btn.click()
  return 'clicked'
})
console.log('add=' + added)
await T(8000)

// 打开联系人的下拉,读选项与当前值
const before = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const tr = rows.find((r) => /联系人/.test(txt(r)))
  const sel = tr?.querySelector('.el-select')
  const input = tr?.querySelector('.el-select__wrapper, input')
  return {
    hasSelect: !!sel,
    value: txt(sel?.querySelector('.el-select__selected-item') || sel),
    docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
  }
})
console.log('before=' + JSON.stringify(before))

// 点开下拉取选项
await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test((r.textContent || '')))
  tr?.querySelector('.el-select__wrapper')?.click()
})
await T(1200)
const opts = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')].map((li) => (li.textContent || '').trim())
  return { count: items.length, sample: items.slice(0, 8) }
})
console.log('options=' + JSON.stringify(opts))
await page.screenshot({ path: dir + '/shots/round-18-contact-select.png' })

// 选「陈秀丽」
const picked = await page.evaluate(() => {
  const li = [...document.querySelectorAll('.el-select-dropdown__item')].find((x) => (x.textContent || '').trim() === '陈秀丽')
  if (!li) return 'not-found'
  li.click()
  return 'picked'
})
console.log('pick=' + picked)
await T(900)

// 带入 1 行明细后保存
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('选择检验项目'))
  if (btn) btn.click()
})
await T(4000)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  const row = dlg?.querySelector('.el-table__body tr')
  const cb = row?.querySelector('.el-checkbox')
  if (cb) cb.click()
})
await T(900)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  const btn = [...dlg.querySelectorAll('button')].find((b) => /带入/.test(b.textContent || ''))
  if (btn) btn.click()
})
await T(3500)

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '保存')
  if (btn) btn.click()
})
await T(7000)

const after = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(txt(r)))
  return {
    contact: txt(tr),
    docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
    box: (() => { const b = document.querySelector('.el-message-box'); return b ? txt(b).slice(0, 200) : '' })(),
  }
})
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: dir + '/shots/round-18-saved.png' })
