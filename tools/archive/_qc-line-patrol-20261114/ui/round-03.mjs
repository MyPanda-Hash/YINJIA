// round-03 — 巡线检验(QC_LINE_PATROL):菜单路径(品质管理→制程品质→巡线检验) / 打印白名单 / 英文界面走查
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-03.mjs')"
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
const SNAP = () => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const cells = {}
  for (const td of qa('.lp-grid tbody td[data-lp]')) {
    const k = td.getAttribute('data-lp')
    const inp = td.querySelector('input')
    cells[k] = cells[k] || []
    cells[k].push(inp ? inp.value : (td.innerText || '').replace(/\s+/g, ' ').trim())
  }
  return {
    hash: location.hash,
    lang: (() => { try { return localStorage.getItem('mes_locale') } catch (e) { return '' } })(),
    title: (q('.lp-title')?.textContent || '').trim(),
    dateLabel: (q('.lp-head-left')?.textContent || '').replace(/\s+/g, ' ').trim(),
    auditorLabel: (q('.lp-head-right')?.textContent || '').replace(/\s+/g, ' ').trim(),
    headers: qa('.lp-grid thead th').map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
    bodyRows: qa('.lp-grid tbody tr').length,
    firstBlock: ['巡线时间', '车间', '编号1', '型号1', '长度实测1', '两液密度', '表面状态', '结果判定', '巡线人员']
      .map((k) => `${k}=${(cells[k] || [])[0] ?? ''}`),
    sideBtns: qa('.as-side-btn').map((x) => (x.textContent || '').trim()).filter(Boolean),
  }
}

// ① 菜单路径走查:我的桌面 → 品质管理 → 制程品质 → 巡线检验
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(4000)
await loginIfNeeded()
await page.waitForTimeout(800)
const menuStep1 = await page.evaluate(() => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const group = qa('.nav-group').find((x) => (x.textContent || '').replace(/\s+/g, '').includes('品质管理'))
  const expandedBefore = qa('.nav-module').some((x) => (x.textContent || '').includes('制程品质'))
  if (!expandedBefore && group) group.click()
  return { groupFound: !!group, expandedBefore }
})
await page.waitForTimeout(1200)
const menuStep2 = await page.evaluate(() => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const mods = qa('.nav-module').map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim())
  const mod = qa('.nav-module').find((x) => (x.textContent || '').includes('制程品质'))
  if (mod) mod.click()
  return { modules: mods, clicked: !!mod }
})
await page.waitForTimeout(1500)
const menuStep3 = await page.evaluate(() => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const leaves = qa('.fly-card .card-item').map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim())
  const target = qa('.fly-card .card-item').find((x) => (x.textContent || '').includes('巡线检验'))
  if (target) target.click()
  return { leaves, clicked: !!target }
})
await page.waitForTimeout(6000)
await restoreWindow()
console.log('MENU=' + JSON.stringify({ ...menuStep1, ...menuStep2, ...menuStep3 }))
console.log('VIA_MENU=' + JSON.stringify(await page.evaluate(SNAP)))
await page.screenshot({ path: out + '/round-03-01-via-menu.png' })

// ② 打印白名单体检(不真的调 window.print,只验 CSS):
//    body.approval-printing 下 .lp-sheet 必须可见(position:static / 纸宽收回),编辑控件不上纸
const printCheck = await page.evaluate(() => {
  document.body.classList.add('approval-printing')
  const el = document.querySelector('.lp-sheet')
  const cs = el ? getComputedStyle(el) : null
  const op = document.querySelector('.lp-op')
  const out = {
    sheetVisibility: cs?.visibility,
    sheetPosition: cs?.position,
    sheetWidth: cs?.width,
    sheetBorder: cs?.borderTopStyle,
    opHidden: op ? getComputedStyle(op).display : '(无操作列)',
    dateInputSuffix: (() => {
      const s = document.querySelector('.lp-head-left .el-input__suffix')
      return s ? getComputedStyle(s).display : '(无)'
    })(),
  }
  document.body.classList.remove('approval-printing')
  return out
})
console.log('PRINT_CSS=' + JSON.stringify(printCheck))

// ③ 英文界面走查:切 en 后菜单/纸面文案不得出现裸中文
await page.evaluate(() => { try { localStorage.setItem('mes_locale', 'en') } catch (e) {} })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(7000)
await loginIfNeeded()
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(6000)
await restoreWindow()
const en = await page.evaluate(SNAP)
console.log('EN_PANEL=' + JSON.stringify(en))
// 菜单叶子(英文)另取一份:回桌面 → 品质管理 → 制程品质 → 读卡片
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(4000)
const enMenu = await page.evaluate(() => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const group = qa('.nav-group').find((x) => /Quality|品质/i.test(x.textContent || ''))
  const expanded = qa('.nav-module').length > 0
  if (group && !expanded) group.click()
  return { groupFound: !!group, expanded }
})
await page.waitForTimeout(1200)
const enMenu2 = await page.evaluate(() => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const mod = qa('.nav-module').find((x) => /Process Quality|制程品质/i.test(x.textContent || ''))
  if (mod) mod.click()
  return { modules: qa('.nav-module').map((x) => (x.textContent || '').trim()), clicked: !!mod }
})
await page.waitForTimeout(1500)
const enLeaves = await page.evaluate(() => [...document.querySelectorAll('.fly-card .card-item')]
  .map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('EN_MENU=' + JSON.stringify({ ...enMenu, ...enMenu2, leaves: enLeaves }))
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(5000)
await restoreWindow()
await page.screenshot({ path: out + '/round-03-02-en-panel.png' })
// 还原中文
await page.evaluate(() => { try { localStorage.setItem('mes_locale', 'zh-CN') } catch (e) {} })
console.log('DONE')
