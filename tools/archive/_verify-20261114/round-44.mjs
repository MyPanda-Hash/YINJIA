// round-44 — 8090(新 jar 6FA1CF34) 第十一轮:同单 DOM 复核 + 导出报表 PDF(UI 路径 + 服务端 API 路径)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => (s.name || '').includes('verify-20261114-r11'))
const task = entry && entry.ownership !== 'agent' ? await takeOverTaskSpace(entry.id) : await taskSpace(entry.id || 'verify-20261114-r11')
const page = (await task.pages())[0]
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}
await page.goto('http://127.0.0.1:8090/', { timeout: 60000 })
await page.waitForTimeout(7000)
let st = await page.evaluate(() => ({
  factory: (document.querySelector('.factory-name')?.textContent || '').trim(),
  chunk: [...document.querySelectorAll('script[src]')].map((s) => s.src.split('/').pop()).filter((n) => n.includes('index-')).slice(0, 2),
  login: !!document.querySelector('input[placeholder*="账号"]'),
}))
console.log('BOOT=' + JSON.stringify(st))
if (st.login) {
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
  await page.waitForTimeout(10000)
}
st = await page.evaluate(() => ({ factory: (document.querySelector('.factory-name')?.textContent || '').trim() }))
console.log('FACTORY=' + JSON.stringify(st))
if (!/测试/.test(st.factory)) {
  try { await page.click('.topbar .factory:not(.locale-switch)', { label: '账套下拉' }) } catch (e) { console.log('factory click err ' + e.message) }
  await page.waitForTimeout(1500)
  const marked = await page.evaluate(() => {
    const its = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
    const t = its.find((e) => /测试/.test((e.textContent || '')))
    if (t) { t.id = 'pick-test-factory'; return true }
    return false
  })
  if (marked) { try { await page.click('#pick-test-factory', { label: '测试库' }) } catch (e) { console.log('pick err ' + e.message) } }
  await page.waitForTimeout(2500)
  const dlg = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    if (!d) return false
    const inp = d.querySelector('input'); if (inp) inp.id = 'fs-pwd'
    const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').includes('切换并重新登录'))
    if (btn) btn.id = 'fs-submit'
    return true
  })
  if (dlg) {
    try { await page.fill('#fs-pwd', '123456') } catch (e) {}
    await page.waitForTimeout(400)
    try { await page.click('#fs-submit', { label: '切换并重新登录' }) } catch (e) { console.log('submit err ' + e.message) }
    await page.waitForTimeout(14000)
  }
  st = await page.evaluate(() => ({ factory: (document.querySelector('.factory-name')?.textContent || '').trim() }))
  console.log('AFTER_SWITCH=' + JSON.stringify(st))
}

// 打开首件面板 + 单据
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_FIRST_INSP', { timeout: 40000 })
await page.waitForTimeout(9000)
const opened = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('SJ-2026-11-0010'))
  if (tr) tr.click()
  return { ok: !!tr, rails: [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 3).map((x) => txt(x)) }
})
console.log('OPEN=' + JSON.stringify(opened))
await page.waitForTimeout(8000)

const dom = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.sample-row')]
  const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => txt(e))
  const cells = rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => {
    const t = td.querySelector('[title]')
    return { bg: getComputedStyle(td).backgroundColor, hasInput: !!td.querySelector('input,textarea'), text: txt(td), title: t ? (t.getAttribute('title') || '') : '' }
  }))
  const fillableRows = cols.map((c, ci) => ({ col: c, rows: cells.map((row, ri) => (row[ci].hasInput ? ri + 1 : null)).filter(Boolean) }))
  const ci = (kw) => cols.findIndex((c) => (c || '').includes(kw))
  const cIdx = ci('挤压')
  const value = (ri) => { const td = rows[ri] && rows[ri].querySelectorAll('td')[cIdx]; if (!td) return null; const i = td.querySelector('input,textarea'); return i ? i.value : txt(td) }
  return {
    factory: (document.querySelector('.factory-name')?.textContent || '').trim(),
    chunk: [...document.querySelectorAll('script[src]')].map((s) => s.src.split('/').pop()).filter((n) => n.includes('index-')).slice(0, 2),
    cols, gzY: document.querySelectorAll('.sample-row td.gz-y').length, slash: cells.flat().filter((c2) => c2.text === '/').length,
    stdCheck: document.querySelectorAll('.standard-row td.std-check').length,
    fillableRows: fillableRows.map((x) => x.col + ':' + x.rows.join('/')),
    compressRows: fillableRows[cIdx] ? fillableRows[cIdx].rows : null,
    compressValues: { '5#': value(4), '6#': value(5), '7#': value(6), '8#': value(7) },
    compress7: cells[6] ? cells[6][cIdx] : null,
    compress8: cells[7] ? cells[7][cIdx] : null,
    editing: !!document.querySelector('.fi-sheet.is-editing'),
  }
})
await fs.writeFile(OUT + '/r11-dom-8090.json', JSON.stringify({ st, opened, dom }, null, 1), 'utf8')
console.log('DOM8090=' + JSON.stringify(dom, null, 1))
await normalWin()
try { await page.screenshot({ path: OUT + '/round-44-r11-8090-dom.png', fullPage: true }); console.log('SHOT_OK') } catch (e) { console.log('SHOT_ERR=' + e.message) }

// —— 导出报表:先看 UI 弹窗文案 ——
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '导出报表')
  if (b) b.click()
})
await page.waitForTimeout(2500)
const dlg = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return d ? { title: txt(d.querySelector('.el-dialog__title')), items: [...d.querySelectorAll('.efmt-item')].map((e) => txt(e)) } : null
})
console.log('REPORT_DIALOG=' + JSON.stringify(dlg))

// —— UI 路径:导出报表→导出 PDF ——
let uiPdf = { ok: false }
try {
  const dl = page.waitForEvent('download', { timeout: 90000 })
  await page.evaluate(() => {
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const item = d && [...d.querySelectorAll('.efmt-item')].find((e) => txt(e).includes('导出 PDF'))
    if (item) item.click()
  })
  const download = await dl
  const name = download.suggestedFilename()
  await download.saveAs(OUT + '/r11-report-ui.pdf')
  uiPdf = { ok: true, name }
} catch (e) { uiPdf = { ok: false, err: String((e && e.message) || e) } }
console.log('UI_PDF=' + JSON.stringify(uiPdf))
await page.waitForTimeout(2500)

// —— 服务端 API 路径:直取 /api/report/export(Jasper) ——
const srv = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const r = await fetch('/api/report/export?code=qc_first_insp&panelCode=QC_FIRST_INSP&docNo=SJ-2026-11-0010&format=pdf', { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  const buf = new Uint8Array(await r.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192))
  return { status: r.status, ct: r.headers.get('content-type'), len: buf.length, b64: btoa(bin) }
})
console.log('SERVER_REPORT=' + JSON.stringify({ status: srv.status, ct: srv.ct, len: srv.len }))
if (srv.status === 200 && srv.len > 1000) await fs.writeFile(OUT + '/r11-report-server.pdf', Buffer.from(srv.b64, 'base64'))
const ls = (await fs.readdir(OUT)).filter((f) => f.startsWith('r11-'))
console.log('FILES=' + JSON.stringify(ls))
console.log('DONE round-44')
