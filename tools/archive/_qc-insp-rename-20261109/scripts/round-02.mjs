// round-02 — 英文语言下改名生效(菜单/页签/左栏/纸面) + 「选生产工单」弹窗提示新名
const OUT = 'C:/Users/vigna/ego/qc-insp-rename-20261109'
const task = await taskSpace(29)
const page = task.page('p1')
console.log('page=' + page.label + ' url=' + (await page.url()))

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

async function setLocaleAndReload(v) {
  await page.evaluate((loc) => { localStorage.setItem('mes_locale', loc) })
  await page.reload({ timeout: 30000 })
  await page.waitForTimeout(6000)
}

// ① 先关掉上一轮可能还开着的弹窗,切英文
await page.keyboard.press('Escape')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(3000)
await setLocaleAndReload('en')
await restoreWindow()
const en = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const q = (s) => [...document.querySelectorAll(s)].map(txt)
  return {
    docTitle: document.title,
    tabs: q('.tabsbar .tab'),
    railTitle: q('.dsr-title'),
    paperTitle: q('.qr-title'),
    bodyHasZhNew: (document.body.innerText || '').includes('出货检验单功能'),
    bodyHasOld: (document.body.innerText || '').includes('制程检验单'),
  }
})
console.log('EN_FACTS ' + JSON.stringify(en, null, 2))
await page.screenshot({ path: OUT + '/r2-en-panel.png' })

// 英文菜单:展开质量管理(Quality Management)组 → 第二个模块(制程品质) → 读卡片叶子
const enMenu = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const groups = [...document.querySelectorAll('.nav-group')]
  const g = groups.find((e) => /Quality/i.test(e.textContent || '')) || groups[6]
  if (g) g.click()
  const mods = [...document.querySelectorAll('.nav-module')]
  const m = mods[1] || mods[0]
  if (m) m.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
  return { group: txt(g), modules: mods.map(txt) }
})
await page.waitForTimeout(1300)
const enCard = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return { cardItems: [...document.querySelectorAll('.fly-card .card-item')].map(txt) }
})
console.log('EN_MENU ' + JSON.stringify({ ...enMenu, ...enCard }, null, 2))
await page.screenshot({ path: OUT + '/r2-en-menu.png' })

// ② 切回中文,核对「选生产工单」弹窗提示(新名)
await setLocaleAndReload('zh-CN')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(5000)
const clickedPicker = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const b = btns.find((x) => (x.textContent || '').replace(/\s+/g, '') === '选生产工单')
  if (b) { b.click(); return true }
  return false
})
console.log('clickedWoPicker=' + clickedPicker)
await page.waitForTimeout(2500)
const picker = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const vis = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = vis[vis.length - 1]
  return {
    titles: vis.map((x) => txt(x.querySelector('.el-dialog__title'))),
    tips: [...(d?.querySelectorAll('.wopick-tip, .wopick-gate') || [])].map(txt),
    bodyHasOld: (d?.innerText || '').includes('制程检验单'),
    bodyHasNew: (d?.innerText || '').includes('出货检验单功能'),
  }
})
console.log('WO_PICKER ' + JSON.stringify(picker, null, 2))
await page.screenshot({ path: OUT + '/r2-wo-picker.png' })
console.log('DONE')
