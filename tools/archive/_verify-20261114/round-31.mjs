// round-31 — 8090(新 jar/新 static) 巡线检验入口 + 纸面 12 列渲染(测试库已有单 XJ-2026-11-0003)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}
async function loginIfNeeded() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]') || !!document.querySelector('input[placeholder*="请输入登录账号"]'))
  if (!need) return false
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.el-select')].find((s) => (s.textContent || '').includes('请选择登录工厂') || (s.textContent || '').includes('正在加载工厂'))
    if (sel) sel.click()
  })
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter((o) => o.offsetParent !== null)
    const t = opts.find((o) => !(o.textContent || '').includes('测试'))
    if (t) t.click()
  })
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
await page.goto('http://127.0.0.1:8090/', { timeout: 60000 })
await page.waitForTimeout(3000)
await loginIfNeeded()
await page.evaluate(() => { try { localStorage.setItem('mes_locale', 'zh-CN') } catch (e) {} })
await page.waitForTimeout(2000)
let st = await page.evaluate(() => ({ factory: (document.querySelector('.factory-name')?.textContent || '').trim(), chunk: [...document.querySelectorAll('script[src]')].map((s) => s.src.split('/').pop()).filter((n) => n.includes('index-')).slice(0, 2) }))
console.log('BOOT=' + JSON.stringify(st))

// 切到测试库
if (!/测试/.test(st.factory)) {
  await page.evaluate(() => {
    const f = [...document.querySelectorAll('.topbar .factory')].find((e) => !e.classList.contains('locale-switch'))
    if (f) f.click()
  })
  await page.waitForTimeout(1200)
  const picked = await page.evaluate(() => {
    const its = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
    const t = its.find((e) => /测试/.test((e.textContent || '')))
    if (t) t.click()
    return its.map((e) => (e.textContent || '').trim())
  })
  console.log('FACTORY_ITEMS=' + JSON.stringify(picked))
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const inp = d && d.querySelector('input')
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
  st = await page.evaluate(() => ({ factory: (document.querySelector('.factory-name')?.textContent || '').trim() }))
  console.log('AFTER_SWITCH=' + JSON.stringify(st))
}

// 菜单入口:悬停 Quality/品质管理 卡片里找巡线检验
await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const grp = [...document.querySelectorAll('.leftnav .nav-group')].find((e) => txt(e).includes('品质管理'))
  if (grp) grp.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true, view: window }))
})
await page.waitForTimeout(2000)
const card = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const fc = [...document.querySelectorAll('.fly-card')].find((e) => e.offsetParent !== null)
  return { groups: fc ? [...fc.querySelectorAll('.card-group-title')].map((e) => txt(e)) : [], items: fc ? [...fc.querySelectorAll('.card-item')].map((e) => txt(e)) : [] }
})
console.log('CARD8090=' + JSON.stringify({ groups: card.groups, hasPatrol: card.items.includes('巡线检验'), idx: card.items.indexOf('巡线检验'), prev: card.items[card.items.indexOf('巡线检验') - 1] }))
// 点击进入
await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const fc = [...document.querySelectorAll('.fly-card')].find((e) => e.offsetParent !== null)
  const item = fc && [...fc.querySelectorAll('.card-item')].find((e) => txt(e) === '巡线检验')
  if (item) item.click()
})
await page.waitForTimeout(8000)
const landed = await page.evaluate(() => ({ hash: location.hash, kickedToLogin: !!document.querySelector('input[placeholder*="账号"]') }))
console.log('LANDED=' + JSON.stringify(landed))

// 打开测试单 XJ-2026-11-0003 看纸面
const opened = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('XJ-2026-11-0003'))
  if (tr) tr.click()
  return { ok: !!tr, rails: [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 4).map((x) => txt(x)) }
})
console.log('OPEN=' + JSON.stringify(opened))
await page.waitForTimeout(8000)
const paper = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const ths = [...document.querySelectorAll('.lp-grid thead th')].map((e) => txt(e))
  const rows = [...document.querySelectorAll('.lp-row')]
  const get = (sel) => { const c = document.querySelector(sel); if (!c) return null; const i = c.querySelector('input'); return i ? i.value : txt(c) }
  return {
    sheet: !!document.querySelector('.lp-sheet'),
    title: txt(document.querySelector('.lp-title')),
    headers: ths,
    headerCount: ths.filter((t) => t && t !== '增删').length,
    blocks: document.querySelectorAll('.lp-grid tbody tr.is-block-first').length,
    rows: rows.length,
    rowspan4: [...document.querySelectorAll('[rowspan="4"]')].length,
    v1: get('.lp-prod[data-lp="编号1"]'),
    vLen: get('.lp-prod[data-lp="长度实测1"]'),
    vShift: get('.lp-block[data-lp="巡线时间"]'),
    vPerson: get('.lp-block[data-lp="巡线人员"]'),
    date: (() => { const i = document.querySelector('.lp-date input'); return i ? i.value : txt(document.querySelector('.lp-date')) })(),
  }
})
console.log('PAPER8090=' + JSON.stringify(paper, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-31-8090-patrol.png', fullPage: true })
await fs.writeFile(OUT + '/b8090-patrol.json', JSON.stringify({ st, card, landed, opened, paper }, null, 1), 'utf8')
console.log('DONE round-31')
