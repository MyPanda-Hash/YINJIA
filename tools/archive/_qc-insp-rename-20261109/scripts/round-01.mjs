// round-01 — 出货检验单功能 改名 + 检验方案弹窗列调整 界面取证(5173 源码版,正式库 YJ)
// 运行:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-insp-rename-20261109/round-01.mjs')"
const OUT = 'C:/Users/vigna/ego/qc-insp-rename-20261109'
const fs = await import('node:fs/promises')
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('qc-insp-rename-20261109')
const page = task.page('p1')
console.log('spaceId=' + task.spaceId + ' page=' + page.label)

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) {
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    }
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

// ① 打开面板
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(5000)
let state = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  hasLogin: !!(document.querySelector('input[placeholder*="账号"]') || document.querySelector('input[placeholder*="密码"]')),
}))
console.log('INIT ' + JSON.stringify(state))

// ② 会话过期则自动登录(admin/123456,工厂默认 YJ=正式库)
if (state.hasLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
    const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (acc) setVal(acc, 'admin')
    if (pwd) setVal(pwd, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(5000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
  await page.waitForTimeout(6000)
}

await restoreWindow()

// ③ 面板事实:页签/左栏标题/纸面标题/菜单
const facts = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const q = (s) => [...document.querySelectorAll(s)].map(txt)
  const body = document.body.innerText || ''
  return {
    hash: location.hash,
    docTitle: document.title,
    tabs: q('.tabsbar .tab'),
    railTitle: q('.dsr-title'),
    paperTitle: q('.qr-title'),
    bandActs: q('.qr-band-act2'),
    docChip: q('.doc-chip'),
    navGroups: q('.nav-group'),
    bodyHasOldName: body.includes('制程检验单'),
    bodyHasNewMenu: body.includes('出货检验单功能'),
    bodyHasNewPaper: body.includes('出货检验记录表'),
    railRowSample: q('.dsr-grid tbody tr').slice(0, 3),
  }
})
console.log('FACTS ' + JSON.stringify(facts, null, 2))
await page.screenshot({ path: OUT + '/r1-panel.png' })

// ④ 打「带入检验项目」弹窗(检验项目/检验方案 → 默认停在「出货检验计划」页签)
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-band-act2')].find((e) => (e.textContent || '').includes('带入检验项目'))
  if (el) { el.click(); return true }
  return false
})
console.log('clickedBringItems=' + clicked)
await page.waitForTimeout(3000)
const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const vis = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = vis[vis.length - 1]
  return {
    dialogTitles: vis.map((x) => txt(x.querySelector('.el-dialog__title'))),
    sourceTabs: [...(d?.querySelectorAll('.el-radio-group .el-radio-button') || [])].map(txt),
    sourceTabActive: txt(d?.querySelector('.el-radio-group .is-active')),
    headers: [...(d?.querySelectorAll('.el-table__header th .cell') || [])].map(txt),
    headerHasForbidden: [...(d?.querySelectorAll('.el-table__header th .cell') || [])].some((th) => (th.textContent || '').includes('不合格应对措施')),
    headerHasFreq: [...(d?.querySelectorAll('.el-table__header th .cell') || [])].some((th) => (th.textContent || '').includes('检查频率')),
    rowCount: d?.querySelectorAll('.el-table__body tbody tr').length || 0,
    emptyText: txt(d?.querySelector('.el-table__empty-text')),
    tip: txt(d?.querySelector('.qcplan-tip')).slice(0, 200),
    bodyHasOldName: (d?.innerText || '').includes('制程检验单'),
  }
})
console.log('DIALOG ' + JSON.stringify(dlg, null, 2))
await page.screenshot({ path: OUT + '/r1-dialog.png' })

// ⑤ 菜单核对:展开「质量管理」→ hover「制程品质」→ 读飞出卡片叶子
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.nav-group')].find((e) => (e.textContent || '').includes('质量管理'))
  if (g) g.click()
})
await page.waitForTimeout(900)
const menu1 = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return { modules: [...document.querySelectorAll('.nav-module')].map(txt) }
})
console.log('MENU1 ' + JSON.stringify(menu1, null, 2))
await page.evaluate(() => {
  const m = [...document.querySelectorAll('.nav-module')].find((e) => (e.textContent || '').includes('制程品质'))
  if (m) m.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
})
await page.waitForTimeout(1200)
const menu2 = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    cardGroups: [...document.querySelectorAll('.fly-card .card-group-title')].map(txt),
    cardItems: [...document.querySelectorAll('.fly-card .card-item')].map(txt),
  }
})
console.log('MENU2 ' + JSON.stringify(menu2, null, 2))
await page.screenshot({ path: OUT + '/r1-menu.png' })

console.log('DONE')
// 保持页签,便于下一轮继续
