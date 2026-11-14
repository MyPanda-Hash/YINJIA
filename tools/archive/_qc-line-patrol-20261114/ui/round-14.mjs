// round-14 — 巡线检验(QC_LINE_PATROL)复核(**测试账套 YJ_TEST / HSDZ_MES_TEST**):
//   登录工厂切到测试库(这次先验证工厂选中再动单据) → 新增 → 填一块 → 保存 → 刷新值仍在
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-14.mjs')"
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
    rows: qa('.lp-grid tbody tr').length,
    inputs: qa('.lp-grid tbody td[data-lp] input').length,
    headers: qa('.lp-grid thead th').map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
    patrolTime: cell('巡线时间'), company: cell('车间'), prodNo1: cell('编号1'),
    density: cell('两液密度'), surface: cell('表面状态'), verdict: cell('结果判定'), inspector: cell('巡线人员'),
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

// ── 登录:先把登录工厂切到「测试库」,并**验证真选中**了再往下走 ──
await page.goto('http://localhost:5173/#/login', { timeout: 40000 })
await page.waitForTimeout(1500)
await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
// 等工厂下拉可用(禁用态 = 工厂列表还在加载)
let facReady = null
for (let i = 0; i < 20; i++) {
  facReady = await page.evaluate(() => {
    const el = document.querySelector('.el-select')
    if (!el) return { ok: false }
    const disabled = el.className.includes('is-disabled')
    const r = el.getBoundingClientRect()
    return { ok: !disabled && r.width > 0, disabled, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: (el.innerText || '').replace(/\s+/g, ' ').trim() }
  })
  if (facReady.ok) break
  await page.waitForTimeout(1000)
}
console.log('FACTORY_READY=' + JSON.stringify(facReady))
await page.mouse.click(facReady.x, facReady.y)
let optLoc = null
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(700)
  optLoc = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const hit = items.find((x) => (x.textContent || '').includes('测试'))
    if (!hit) return { ok: false, items: items.map((x) => (x.textContent || '').trim()) }
    const r = hit.getBoundingClientRect()
    return { ok: r.width > 0, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: (hit.textContent || '').trim() }
  })
  if (optLoc.ok) break
}
console.log('FACTORY_OPTION=' + JSON.stringify(optLoc))
if (optLoc && optLoc.ok) {
  await page.mouse.click(optLoc.x, optLoc.y)
  await page.waitForTimeout(1000)
}
const facSelected = await page.evaluate(() => {
  const el = document.querySelector('.el-select')
  return (el?.innerText || '').replace(/\s+/g, ' ').trim()
})
console.log('FACTORY_SELECTED=' + JSON.stringify(facSelected))
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
const afterLogin = await page.evaluate(() => ({
  hash: location.hash,
  factory: (() => { try { return JSON.parse(localStorage.getItem('mes_factory') || '{}') } catch (e) { return {} } })(),
  topbar: (document.querySelector('.topbar')?.innerText || '').replace(/\s+/g, ' ').slice(0, 140),
}))
console.log('LOGIN=' + JSON.stringify(afterLogin))
const isTest = JSON.stringify(afterLogin.factory).includes('TEST') || JSON.stringify(afterLogin.factory).includes('测试')
if (!isTest) { console.log('ABORT=登录工厂没切到测试库,不再动单据'); console.log('DONE'); process.exit ? null : null }
else {
  await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
  await page.waitForTimeout(6000)
  await restoreWindow()
  console.log('TESTDB_S1=' + JSON.stringify(await page.evaluate(SNAP)))
  await page.screenshot({ path: out + '/round-14-01-testdb-empty.png' })
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
  console.log('TESTDB_S2=' + JSON.stringify(await page.evaluate(SNAP)))
  await page.screenshot({ path: out + '/round-14-02-testdb-filled.png' })
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').trim() === '保存')
    if (b) b.click()
  })
  await page.waitForTimeout(7000)
  await page.reload({ timeout: 40000 })
  await page.waitForTimeout(7000)
  await restoreWindow()
  console.log('TESTDB_S3_AFTER_RELOAD=' + JSON.stringify(await page.evaluate(SNAP)))
  await page.screenshot({ path: out + '/round-14-03-testdb-saved.png' })
}
console.log('DONE')
