// round-02 — 巡线检验(QC_LINE_PATROL):逐格填写 → 保存 → 刷新后值仍在(落库) + 菜单路径走查
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-02.mjs')"
const out = 'C:/Users/vigna/ego/qc-line-patrol-20261114'
const task = await taskSpace('qc-line-patrol-20261114')
const page = task.page('p1')

async function loginIfNeeded() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
  if (!need) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(9000)
  return true
}
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip') }
}
/** 纸面状态快照:表头/块数/每个可填格的值 */
const SNAP = () => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  /** field → 各块的值数组(DOM 顺序 = 块顺序) */
  const cells = {}
  for (const td of qa('.lp-grid tbody td[data-lp]')) {
    const k = td.getAttribute('data-lp')
    const inp = td.querySelector('input')
    const v = inp ? inp.value : (td.innerText || '').replace(/\s+/g, ' ').trim()
    cells[k] = cells[k] || []
    cells[k].push(v)
  }
  return {
    hash: location.hash,
    sheet: !!q('.lp-sheet'),
    headers: qa('.lp-grid thead th').map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
    bodyRows: qa('.lp-grid tbody tr').length,
    cells,
    messages: qa('.el-message').map((x) => (x.textContent || '').trim()),
    tabTitle: (q('.tabsbar .tab.active, .tabsbar .tab-item.active, .tab.is-active')?.textContent || '').replace(/\s+/g, ' ').trim(),
    dateVal: (q('.lp-head-left input')?.value) || '',
  }
}

await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(4000)
await loginIfNeeded()
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(5000)

// ① 逐格填写(第 1 块全填 / 第 2 块部分 / 第 3 块最少)
const fill = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const byField = {}
  for (const td of document.querySelectorAll('.lp-grid tbody td[data-lp]')) {
    const inp = td.querySelector('input')
    if (!inp) continue
    const k = td.getAttribute('data-lp')
    ;(byField[k] = byField[k] || []).push(inp)
  }
  const set = (field, i, v) => { const a = byField[field] || []; if (!a[i]) return false; setVal(a[i], v); return true }
  const data = {
    '巡线时间': ['08:30', '10:30', '13:30'],
    '车间': ['成型一车间', '成型二车间', '成型一车间'],
    '编号1': ['CR-001', 'CR-003', 'CR-005'],
    '型号1': ['A-100', 'A-102', 'A-104'],
    '长度标准1': ['112.0', '112.0', '112.0'],
    '长度实测1': ['112.1', '111.9', '112.0'],
    '内径标准1': ['8.0', '8.0', '8.0'],
    '内径实测1': ['8.05', '7.98', '8.01'],
    '重量标准1': ['5.0', '5.0', '5.0'],
    '重量实测1': ['5.02', '4.99', '5.01'],
    '编号2': ['CR-002', 'CR-004', ''],
    '型号2': ['A-101', 'A-103', ''],
    '长度标准2': ['112.0', '112.0', ''],
    '长度实测2': ['111.9', '112.2', ''],
    '内径标准2': ['8.0', '8.0', ''],
    '内径实测2': ['7.98', '8.03', ''],
    '重量标准2': ['5.0', '5.0', ''],
    '重量实测2': ['4.99', '5.04', ''],
    '两液密度': ['1.02', '1.01', '1.03'],
    '表面状态': ['无粘模', '轻微粘模', '无粘模'],
    '跌落强度': ['合格', '合格', '合格'],
    '抗压强度': ['合格', '合格', '合格'],
    '结果判定': ['合格', '合格', '合格'],
    '巡线人员': ['张三', '李四', '王五'],
  }
  const missing = []
  for (const [field, vals] of Object.entries(data)) {
    vals.forEach((v, i) => { if (v !== '' && !set(field, i, v)) missing.push(`${field}[${i}]`) })
  }
  return { filledFields: Object.keys(data).length, missing }
})
console.log('FILL=' + JSON.stringify(fill))
await page.waitForTimeout(1200)
await restoreWindow()
console.log('AFTER_FILL=' + JSON.stringify(await page.evaluate(SNAP)))
await page.screenshot({ path: out + '/round-02-01-filled.png' })

// ② 保存(侧栏「保存」)
const saved = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').trim() === '保存')
  if (!btn) return false
  btn.click()
  return true
})
console.log('CLICK_SAVE=' + saved)
await page.waitForTimeout(7000)
await restoreWindow()
console.log('AFTER_SAVE=' + JSON.stringify(await page.evaluate(SNAP)))
await page.screenshot({ path: out + '/round-02-02-saved.png' })

// ③ 刷新页面 → 值仍在(真落库)
await page.reload({ timeout: 40000 })
await page.waitForTimeout(7000)
await loginIfNeeded()
await restoreWindow()
console.log('AFTER_RELOAD=' + JSON.stringify(await page.evaluate(SNAP)))
await page.screenshot({ path: out + '/round-02-03-after-reload.png' })

// ④ 菜单路径走查:我的桌面 → 品质管理 → 制程品质 → 巡线检验
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(4000)
const menu = await page.evaluate(() => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const clickText = (sel, text) => {
    const el = qa(sel).find((x) => (x.textContent || '').replace(/\s+/g, '').includes(text))
    if (!el) return false
    el.click()
    return true
  }
  const step1 = clickText('.nav-group', '品质管理')
  return { step1 }
})
await page.waitForTimeout(1200)
const menu2 = await page.evaluate(() => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const mod = qa('.nav-module').find((x) => (x.textContent || '').includes('制程品质'))
  if (!mod) return { step2: false }
  mod.click()
  return { step2: true }
})
await page.waitForTimeout(1200)
const menuLeaves = await page.evaluate(() => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const leaves = qa('.fly-card .card-item').map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim())
  const target = qa('.fly-card .card-item').find((x) => (x.textContent || '').includes('巡线检验'))
  if (target) target.click()
  return { leaves, clicked: !!target }
})
await page.waitForTimeout(6000)
await restoreWindow()
console.log('MENU1=' + JSON.stringify(menu) + ' MENU2=' + JSON.stringify(menu2) + ' LEAVES=' + JSON.stringify(menuLeaves))
console.log('AFTER_MENU=' + JSON.stringify(await page.evaluate(SNAP)))
await page.screenshot({ path: out + '/round-02-04-via-menu.png' })
console.log('DONE')
