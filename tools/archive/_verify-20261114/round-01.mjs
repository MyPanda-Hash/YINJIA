// round-01 — A1: 首件检验单(QC_FIRST_INSP) 5173 新草稿 DOM 取证
// 跑法: ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/verify-20261114/round-01.mjs')"
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const task = await taskSpace('verify-20261114')
const page = await (async () => {
  const pages = await task.pages()
  if (pages.length) return pages[0]
  return await task.newPage()
})()

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

async function loginIfNeeded() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]') || !!document.querySelector('input[placeholder*="请输入登录账号"]'))
  if (!need) return false
  // 先选登录工厂(YJ_TEST=测试库)
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.el-select')].find((s) => (s.textContent || '').includes('请选择登录工厂') || (s.textContent || '').includes('正在加载工厂'))
    if (sel) sel.click()
  })
  await page.waitForTimeout(800)
  const picked = await page.evaluate(() => {
    const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter((o) => o.offsetParent !== null)
    const t = opts.find((o) => (o.textContent || '').includes('测试'))
    if (!t) return { picked: false, opts: opts.map((o) => (o.textContent || '').trim()) }
    t.click()
    return { picked: true, text: (t.textContent || '').trim(), opts: opts.map((o) => (o.textContent || '').trim()) }
  })
  console.log('LOGIN_FACTORY=' + JSON.stringify(picked))
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
await page.waitForTimeout(2500)
await loginIfNeeded()
await page.evaluate(() => { try { localStorage.setItem('mes_locale', 'zh-CN') } catch (e) {} })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(6000)
await loginIfNeeded()
const state = await page.evaluate(() => ({
  hash: location.hash,
  factory: (document.querySelector('.factory-name')?.textContent || '').trim(),
  user: (document.querySelector('.user-name')?.textContent || '').trim(),
}))
console.log('STATE=' + JSON.stringify(state))

// 打开首件检验单列表
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 })
await page.waitForTimeout(5000)
const opened = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.as-side-btn')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '新增')
  if (b) b.click()
  return { clicked: !!b, btns }
})
console.log('OPEN_NEW=' + JSON.stringify(opened))
await page.waitForTimeout(6000)

// —— DOM 取证 ——
const ev = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)]
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const bg = (e) => getComputedStyle(e).backgroundColor
  const sampleRows = q('.sample-row')
  const cols = q('.col-head .fi-colhead-text').map((e) => txt(e))
  const cells = sampleRows.map((tr) => [...tr.querySelectorAll('td')].map((td) => {
    const titleEl = td.querySelector('[title]')
    return {
      cls: td.className,
      bg: getComputedStyle(td).backgroundColor,
      hasInput: !!td.querySelector('input,textarea'),
      boxes: td.querySelectorAll('.fi-box').length,
      text: txt(td),
      title: titleEl ? (titleEl.getAttribute('title') || '') : '',
    }
  }))
  const stdCells = q('.standard-row td').map((td) => ({
    cls: td.className,
    bg: getComputedStyle(td).backgroundColor,
    hasCtrl: !!td.querySelector('input,textarea'),
    text: txt(td),
  }))
  const fillable = {} // colKey(index) -> 可填行
  const expectedMatrix = []
  cells.forEach((row, ri) => {
    row.forEach((c, ci) => {
      const can = c.hasInput || c.boxes > 0
      if (can) (fillable[ci] = fillable[ci] || []).push(ri + 1)
      expectedMatrix.push([ri + 1, ci, can])
    })
  })
  const slashCells = cells.flat().filter((c) => c.text === '/').length
  return {
    hash: location.hash,
    sheetPresent: !!document.querySelector('.fi-grid'),
    sampleRowCount: sampleRows.length,
    colHeads: cols,
    sampleTdTotal: cells.flat().length,
    gzYCount: q('.sample-row td.gz-y').length,
    gzYColors: [...new Set(q('.sample-row td.gz-y').map((e) => getComputedStyle(e).backgroundColor))],
    stdTdTotal: stdCells.length,
    stdCheckCount: q('.standard-row td.std-check').length,
    stdCheckColors: [...new Set(q('.standard-row td.std-check').map((e) => getComputedStyle(e).backgroundColor))],
    stdCheckHasCtrl: q('.standard-row td.std-check input, .standard-row td.std-check textarea').length,
    slashCells,
    fillable,
    sampleTitles: cells.map((row) => row.map((c) => c.title)),
    sampleTexts: cells.map((row) => row.map((c) => c.text)),
    sampleClasses: cells.map((row) => row.map((c) => c.cls)),
    stdCells,
    checkBoxCount: q('.sample-row .fi-box').length,
    dialog: q('.el-dialog').filter((d) => d.offsetParent !== null).map((d) => txt(d).slice(0, 120)),
  }
})
console.log('A1=' + JSON.stringify(ev, null, 1))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-01-first-insp-5173.png', fullPage: false })
console.log('DONE round-01')
