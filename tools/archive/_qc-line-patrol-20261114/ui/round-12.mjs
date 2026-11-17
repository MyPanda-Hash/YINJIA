// round-12 — 巡线检验(QC_LINE_PATROL)在**测试账套 YJ_TEST(HSDZ_MES_TEST)** 复核:
//            间距调整后的纸面(车间列加宽) + 新增/填写/保存/刷新 + 打印预览出新窗口 PDF。
//            (正式库 HSDZ_MES 的测试单已按 Lead 要求清理,后续自测一律走测试库)
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-12.mjs')"
const out = 'C:/Users/vigna/ego/qc-line-patrol-20261114'
const task = await taskSpace('qc-line-patrol-20261114')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip') }
}
/** 登录(可指定登录工厂选项文字关键字);返回登录后的工厂名/账号 */
async function login(factoryKeyword) {
  await page.goto('http://localhost:5173/#/login', { timeout: 40000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 40000 })
  await page.waitForTimeout(4000)
  // 选登录工厂(el-select → 下拉 → 选项)
  if (factoryKeyword) {
    const sel = await page.evaluate(() => {
      const el = document.querySelector('.el-select')
      if (!el) return false
      const r = el.getBoundingClientRect()
      el.setAttribute('data-lp-fac', '1')
      window.__facXY = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
      return true
    })
    if (sel) {
      const xy = await page.evaluate(() => window.__facXY)
      await page.mouse.click(xy.x, xy.y)
      await page.waitForTimeout(1200)
      const optLoc = await page.evaluate((kw) => {
        const items = [...document.querySelectorAll('.el-select-dropdown__item')]
        const hit = items.find((x) => (x.textContent || '').includes(kw))
        if (!hit) return { ok: false, items: items.map((x) => (x.textContent || '').trim()) }
        const r = hit.getBoundingClientRect()
        return { ok: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
      }, factoryKeyword)
      console.log('FACTORY_OPTIONS=' + JSON.stringify(optLoc.items || optLoc))
      if (optLoc.ok) { await page.mouse.click(optLoc.x, optLoc.y); await page.waitForTimeout(800) }
    }
  }
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
  await page.waitForTimeout(10000)
  return await page.evaluate(() => ({
    hash: location.hash,
    factory: (() => { try { return JSON.parse(localStorage.getItem('mes_factory') || '{}').name } catch (e) { return '' } })(),
    topbar: (document.querySelector('.topbar')?.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
  }))
}
const SNAP = () => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const q = (s) => document.querySelector(s)
  const cell = (f, i = 0) => {
    const td = qa(`.lp-grid tbody td[data-lp="${f}"]`)[i]
    if (!td) return ''
    const inp = td.querySelector('input')
    return inp ? inp.value : (td.innerText || '').replace(/\s+/g, ' ').trim()
  }
  return {
    hash: location.hash,
    sheet: !!q('.lp-sheet'),
    headers: qa('.lp-grid thead th').map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
    rows: qa('.lp-grid tbody tr').length,
    inputs: qa('.lp-grid tbody td[data-lp] input').length,
    company: cell('车间'),
    patrolTime: cell('巡线时间'),
    prodNo1: cell('编号1'),
    /** 车间格实际渲染宽度(看「成型一车间」5 字是否放得下:5 字 ≈ 65px) */
    workshopCellWidth: (() => {
      const td = qa('.lp-grid tbody td[data-lp="车间"]')[0]
      return td ? Math.round(td.getBoundingClientRect().width) : 0
    })(),
    workshopInputClipped: (() => {
      const td = qa('.lp-grid tbody td[data-lp="车间"]')[0]
      const inp = td?.querySelector('input')
      return inp ? inp.scrollWidth > inp.clientWidth + 1 : null
    })(),
    railText: qa('.doc-select-rail tbody tr').map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim()),
  }
}

console.log('LOGIN=' + JSON.stringify(await login('测试库')))
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(6000)
await restoreWindow()
console.log('TEST_S1=' + JSON.stringify(await page.evaluate(SNAP)))
await page.screenshot({ path: out + '/round-12-01-test-db-empty.png' })

// 新增 + 填一块 + 保存
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').trim() === '新增')
  if (b) b.click()
})
await page.waitForTimeout(6000)
const fill = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const byField = {}
  for (const td of document.querySelectorAll('.lp-grid tbody td[data-lp]')) {
    const inp = td.querySelector('input')
    if (inp) (byField[td.getAttribute('data-lp')] = byField[td.getAttribute('data-lp')] || []).push(inp)
  }
  const data = {
    '巡线时间': ['09:15'], '车间': ['成型一车间'], '编号1': ['CR-T01'], '型号1': ['A-900'],
    '长度标准1': ['112.0'], '长度实测1': ['112.05'], '内径标准1': ['8.0'], '内径实测1': ['8.01'],
    '重量标准1': ['5.0'], '重量实测1': ['5.01'], '编号2': ['CR-T02'], '型号2': ['A-901'],
    '长度标准2': ['112.0'], '长度实测2': ['111.95'], '内径标准2': ['8.0'], '内径实测2': ['7.99'],
    '重量标准2': ['5.0'], '重量实测2': ['4.98'], '两液密度': ['1.02'], '表面状态': ['无粘模'],
    '跌落强度': ['合格'], '抗压强度': ['合格'], '结果判定': ['合格'], '巡线人员': ['测试员'],
  }
  const missing = []
  for (const [f, vals] of Object.entries(data)) {
    vals.forEach((v, i) => {
      const a = byField[f] || []
      if (!a[i]) missing.push(`${f}[${i}]`)
      else setVal(a[i], v)
    })
  }
  return { missing }
})
console.log('FILL=' + JSON.stringify(fill))
await page.waitForTimeout(1000)
await restoreWindow()
console.log('TEST_S2=' + JSON.stringify(await page.evaluate(SNAP)))
await page.screenshot({ path: out + '/round-12-02-test-filled.png' })
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').trim() === '保存')
  if (b) b.click()
})
await page.waitForTimeout(7000)
await page.reload({ timeout: 40000 })
await page.waitForTimeout(7000)
await restoreWindow()
console.log('TEST_S3_AFTER_SAVE_RELOAD=' + JSON.stringify(await page.evaluate(SNAP)))
await page.screenshot({ path: out + '/round-12-03-test-saved.png' })

// 打印预览:新窗口 blob PDF(测试库这张单)
const before = (await task.tabs()).length
const loc = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').trim() === '导出报表')
  if (!b) return { ok: false }
  b.scrollIntoView({ block: 'center' })
  const r = b.getBoundingClientRect()
  return { ok: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})
await page.mouse.click(loc.x, loc.y)
await page.waitForTimeout(1800)
const itemLoc = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const it = [...(d?.querySelectorAll('.efmt-item') || [])][1]
  if (!it) return { ok: false }
  const r = it.getBoundingClientRect()
  return { ok: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})
await page.mouse.click(itemLoc.x, itemLoc.y)
let previewTab = null
let pdfInfo = null
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(2000)
  const tabs = await task.tabs()
  const hit = tabs.find((t) => String(t.url || '').startsWith('blob:'))
  if (hit) { previewTab = hit; break }
}
if (previewTab) {
  const p2 = previewTab.label ? task.page(previewTab.label) : await task.adopt(previewTab.page)
  await p2.waitForTimeout(2000)
  try {
    const w = await p2.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p2.waitForTimeout(600)
  } catch (e) { /* ignore */ }
  try { await p2.screenshot({ path: out + '/round-12-04-test-preview-pdf.png' }) } catch (e) { console.log('shot fail') }
  pdfInfo = await p2.evaluate(async () => {
    const url = location.href
    try {
      const r = await fetch(url)
      const buf = new Uint8Array(await r.arrayBuffer())
      const head = String.fromCharCode(...buf.slice(0, 8))
      return { url: url.slice(0, 60), bytes: buf.length, head, isPdf: head.startsWith('%PDF-') }
    } catch (e) { return { url: url.slice(0, 60), error: String(e && e.message) } }
  })
  if (previewTab.label) { try { await p2.close() } catch (e) { /* ignore */ } }
}
console.log('PREVIEW=' + JSON.stringify({ before, now: (await task.tabs()).length, pdfInfo }))
await page.screenshot({ path: out + '/round-12-05-test-after-preview.png' })
console.log('DONE')
