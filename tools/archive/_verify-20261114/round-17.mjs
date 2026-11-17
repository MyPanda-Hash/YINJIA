// round-17 — A4: 8090(新 jar) 打开首件检验单 SJ-2026-11-0011 → 导出报表 PDF + 打包版 DOM 复核
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
    const sel = [...document.querySelectorAll('.el-select')].find((s) => (s.textContent || '').includes('请选择登录工厂') || (s.textContent || '').includes('正在加载工厂'))
    if (sel) sel.click()
  })
  await page.waitForTimeout(900)
  const picked = await page.evaluate(() => {
    const opts = [...document.querySelectorAll('.el-select-dropdown__item')].filter((o) => o.offsetParent !== null)
    const t = opts.find((o) => !(o.textContent || '').includes('测试'))
    if (t) t.click()
    return opts.map((o) => (o.textContent || '').trim())
  })
  console.log('FACTORY_OPTS=' + JSON.stringify(picked))
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
console.log('LOGIN=' + await loginIfNeeded())
await page.evaluate(() => { try { localStorage.setItem('mes_locale', 'zh-CN') } catch (e) {} })
await page.waitForTimeout(2500)
const boot = await page.evaluate(() => ({
  hash: location.hash,
  factory: (document.querySelector('.factory-name')?.textContent || '').trim(),
  chunk: [...document.querySelectorAll('script[src]')].map((s) => s.src.split('/').pop()).filter((n) => n.includes('index-')).slice(0, 3),
}))
console.log('BOOT8090=' + JSON.stringify(boot))

// 打开首件检验单面板
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_FIRST_INSP', { timeout: 40000 })
await page.waitForTimeout(8000)
const opened = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('SJ-2026-11-0011'))
  if (tr) tr.click()
  return { found: !!tr, railNos: [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 4).map((x) => txt(x.querySelector('td'))) }
})
console.log('OPEN=' + JSON.stringify(opened))
await page.waitForTimeout(7000)

// 打包版 DOM 复核(黄格矩阵)
const dom = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.sample-row')]
  const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => txt(e))
  const fillable = cols.map((c, ci) => ({
    c, rows: rows.map((tr, ri) => (tr.querySelectorAll('td')[ci].querySelector('input,textarea,.fi-box') ? ri + 1 : null)).filter(Boolean),
  }))
  const cells = rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => txt(td)))
  return {
    sheet: !!document.querySelector('.fi-grid'),
    cols,
    sampleRows: rows.length,
    gzY: document.querySelectorAll('.sample-row td.gz-y').length,
    gzYColor: (() => { const e = document.querySelector('.sample-row td.gz-y'); return e ? getComputedStyle(e).backgroundColor : null })(),
    slash: cells.flat().filter((t) => t === '/').length,
    stdCheck: document.querySelectorAll('.standard-row td.std-check').length,
    stdColor: (() => { const e = document.querySelector('.standard-row td.std-check'); return e ? getComputedStyle(e).backgroundColor : null })(),
    fillable: fillable.map((f) => f.c + ':' + f.rows.join('/')),
    values: {
      outer3: (() => { const ci = cols.findIndex((c) => c.includes('外径')); const el = rows[2] && rows[2].querySelectorAll('td')[ci].querySelector('input,textarea'); return el ? el.value : (rows[2] ? txt(rows[2].querySelectorAll('td')[ci]) : null) })(),
      drop5: (() => { const ci = cols.findIndex((c) => c.includes('跌落')); const el = rows[4] && rows[4].querySelectorAll('td')[ci].querySelector('input,textarea'); return el ? el.value : (rows[4] ? txt(rows[4].querySelectorAll('td')[ci]) : null) })(),
      press7: (() => { const ci = cols.findIndex((c) => c.includes('挤压')); const el = rows[6] && rows[6].querySelectorAll('td')[ci].querySelector('input,textarea'); return el ? el.value : (rows[6] ? txt(rows[6].querySelectorAll('td')[ci]) : null) })(),
    },
  }
})
console.log('DOM8090=' + JSON.stringify(dom, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-17-8090-first-insp.png', fullPage: true })

// 导出报表 → 导出 PDF
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '导出报表')
  if (b) b.click()
})
await page.waitForTimeout(2500)
const repDialog = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return { dialog: !!dlg, title: dlg ? txt(dlg.querySelector('.el-dialog__title')) : '', items: dlg ? [...dlg.querySelectorAll('.efmt-item')].map((e) => txt(e)) : [] }
})
console.log('REPORT_DIALOG=' + JSON.stringify(repDialog))
await normalWin()
await page.screenshot({ path: OUT + '/round-17-report-dialog.png' })

let pdf = { ok: false }
try {
  const dl = page.waitForEvent('download', { timeout: 90000 })
  await page.evaluate(() => {
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const item = dlg && [...dlg.querySelectorAll('.efmt-item')].find((e) => txt(e).includes('PDF'))
    if (item) item.click()
  })
  const download = await dl
  const name = download.suggestedFilename()
  await download.saveAs(OUT + '/a4-report.pdf')
  pdf = { ok: true, name }
} catch (e) {
  pdf = { ok: false, err: String((e && e.message) || e) }
}
console.log('A4_PDF=' + JSON.stringify(pdf))
await page.waitForTimeout(3000)
const st = await page.evaluate(() => ({ dialogs: [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null).length, msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()) }))
console.log('STATE=' + JSON.stringify(st))
const ls = await fs.readdir(OUT)
console.log('FILES=' + JSON.stringify(ls.filter((f) => f.startsWith('a4-'))))
console.log('DONE round-17')
