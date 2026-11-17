// round-21 — B1/B2:5173 切到 YJ_TEST(测试库) → 巡线检验菜单/面板 → 新建草稿纸面取证
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]

async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) {}
}
async function loginIfNeeded() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]') || !!document.querySelector('input[placeholder*="请输入登录账号"]'))
  if (!need) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
    const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (acc) setVal(acc, 'admin')
    if (pwd) setVal(pwd, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(9000)
  return true
}

await page.goto('http://localhost:5173/', { timeout: 60000 })
await page.waitForTimeout(4000)
await loginIfNeeded()
await page.evaluate(() => { try { localStorage.setItem('mes_locale', 'zh-CN') } catch (e) {} })
await page.waitForTimeout(2000)
const before = await page.evaluate(() => ({ factory: (document.querySelector('.factory-name')?.textContent || '').trim(), hash: location.hash }))
console.log('BEFORE=' + JSON.stringify(before))

// —— 切账套到 YJ_TEST(测试库) ——
if (!/测试/.test(before.factory)) {
  const opened = await page.evaluate(() => {
    const f = [...document.querySelectorAll('.topbar .factory')].find((e) => !e.classList.contains('locale-switch'))
    if (f) f.click()
    return !!f
  })
  await page.waitForTimeout(1200)
  const items = await page.evaluate(() => {
    const its = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
    return its.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  })
  console.log('FACTORY_MENU=' + JSON.stringify(items))
  const picked = await page.evaluate(() => {
    const its = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
    const t = its.find((e) => /测试/.test((e.textContent || '')))
    if (t) t.click()
    return !!t
  })
  console.log('PICKED=' + picked)
  await page.waitForTimeout(1500)
  const dlg = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    return { open: !!d, title: d ? (d.querySelector('.el-dialog__title')?.textContent || '').trim() : '' }
  })
  console.log('SWITCH_DIALOG=' + JSON.stringify(dlg))
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const inp = d && d.querySelector('input[type="password"], input')
    if (inp) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(inp, '123456')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const btn = d && [...d.querySelectorAll('button')].find((b) => (b.textContent || '').includes('切换并重新登录'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(12000)
  await loginIfNeeded()
}
const after = await page.evaluate(() => ({ factory: (document.querySelector('.factory-name')?.textContent || '').trim(), hash: location.hash }))
console.log('AFTER_SWITCH=' + JSON.stringify(after))

// —— B1: 菜单存在 ——
const menu = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const hit = [...document.querySelectorAll('.el-menu-item, .el-sub-menu__title, .nav-item, .menu-item')].find((e) => txt(e) === '巡线检验' || txt(e).includes('巡线检验'))
  const chain = []
  let el = hit
  while (el && chain.length < 6) {
    chain.push({ tag: el.tagName, cls: el.className, t: txt(el).slice(0, 40) })
    el = el.parentElement
  }
  return {
    found: !!hit,
    visible: hit ? hit.offsetParent !== null : false,
    chain,
    allTopMenus: [...document.querySelectorAll('.el-menu-item, .el-sub-menu__title')].map((e) => txt(e)).filter(Boolean).slice(0, 40),
  }
})
console.log('MENU=' + JSON.stringify(menu, null, 1))

// —— 打开巡线检验面板(直接路由,验证可进) ——
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(8000)
const panel = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return { hash: location.hash, kickedToLogin: !!document.querySelector('input[placeholder*="账号"]'), sideBtns: [...document.querySelectorAll('.as-side-btn')].map((e) => txt(e)) }
})
console.log('PANEL=' + JSON.stringify(panel))

// —— 新建草稿 ——
const newClicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '新增')
  if (b) b.click()
  return !!b
})
console.log('NEW=' + newClicked)
await page.waitForTimeout(8000)

// —— B2: 纸面取证 ——
const paper = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const sheet = document.querySelector('.lp-sheet')
  const ths = [...document.querySelectorAll('.lp-grid thead th')].map((e) => txt(e))
  const rows = [...document.querySelectorAll('.lp-row')]
  const blocks = document.querySelectorAll('.lp-grid tbody tr.is-block-first').length
  const blockCells = [...document.querySelectorAll('.lp-block')].slice(0, 6).map((e) => ({ key: e.getAttribute('data-lp'), rowspan: e.getAttribute('rowspan') }))
  const prodCells = [...document.querySelectorAll('.lp-prod')].slice(0, 4).map((e) => ({ field: e.getAttribute('data-lp'), t: txt(e) }))
  const rs = [...document.querySelectorAll('[rowspan]')].map((e) => e.getAttribute('rowspan'))
  return {
    sheet: !!sheet,
    editing: !!document.querySelector('.lp-sheet.is-editing'),
    title: txt(document.querySelector('.lp-title')),
    dateLabel: txt(document.querySelector('.lp-head-left')),
    approver: txt(document.querySelector('.lp-head-right')),
    headers: ths,
    headerCount: ths.filter((t) => t && t !== '增删').length,
    rowCount: rows.length,
    firstBlockRows: rows.slice(0, 4).map((r) => [...r.querySelectorAll('td,th')].map((c) => txt(c)).slice(0, 14)),
    blocks,
    blockCells,
    prodCells,
    rowspan4Count: rs.filter((x) => x === '4').length,
    inputs: document.querySelectorAll('.lp-grid input').length,
  }
})
console.log('PAPER=' + JSON.stringify(paper, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-21-patrol-5173.png', fullPage: true })
await fs.writeFile(OUT + '/b1b2-paper.json', JSON.stringify({ before, after, menu, panel, paper }, null, 1), 'utf8')
console.log('DONE round-21')
