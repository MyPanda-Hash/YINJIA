// round-04 — 巡线检验(QC_LINE_PATROL):增删块 / 空表「＋新增巡线记录」/ 打印版式(CSS 模拟 print 媒体)/ 二次保存
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-04.mjs')"
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
/** 块表快照:每块的第 1 个可填格值(看块顺序/增删是否正确) */
const BLOCKS = () => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const val = (field) => qa(`.lp-grid tbody td[data-lp="${field}"]`).map((td) => {
    const i = td.querySelector('input')
    return i ? i.value : (td.innerText || '').replace(/\s+/g, ' ').trim()
  })
  return {
    rows: qa('.lp-grid tbody tr').length,
    blockCells: qa('.lp-grid tbody td.lp-block').length,
    opBtns: qa('.lp-op .lp-btn').length,
    patrolTime: val('巡线时间'),
    auditor: val('巡线人员'),
    prodNo1: val('编号1'),
    emptyHint: (document.querySelector('.lp-empty')?.textContent || '').replace(/\s+/g, ' ').trim(),
    addLink: !!document.querySelector('.lp-addblock'),
    headers: qa('.lp-grid thead th').map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
  }
}
const clickOp = (kind, blockIdx) => {
  const qa = (s) => [...document.querySelectorAll(s)]
  const ops = qa('.lp-op .lp-btn')
  const el = ops[blockIdx * 2 + (kind === 'del' ? 1 : 0)]
  if (!el) return false
  el.click()
  return true
}

await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(4000)
await loginIfNeeded()
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6000)
await restoreWindow()
console.log('INIT=' + JSON.stringify(await page.evaluate(BLOCKS)))

// ① 当前单:第 2 块之后插入一块 → 4 块;再删掉插入的那块 → 3 块(原值不动)
console.log('ADD_AFTER_BLOCK2=' + (await page.evaluate(() => {
  const ops = [...document.querySelectorAll('.lp-op .lp-btn')]
  const el = ops[1 * 2]
  if (!el) return false
  el.click()
  return true
})))
await page.waitForTimeout(1200)
console.log('AFTER_ADD=' + JSON.stringify(await page.evaluate(BLOCKS)))
await restoreWindow()
await page.screenshot({ path: out + '/round-04-01-added-block.png' })
console.log('DEL_BLOCK3=' + (await page.evaluate(() => {
  const ops = [...document.querySelectorAll('.lp-op .lp-btn')]
  const el = ops[2 * 2 + 1]
  if (!el) return false
  el.click()
  return true
})))
await page.waitForTimeout(1200)
console.log('AFTER_DEL=' + JSON.stringify(await page.evaluate(BLOCKS)))
// 再存一次(值没变,证明增删后保存不丢块、不重复)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').trim() === '保存')
  if (btn) btn.click()
})
await page.waitForTimeout(6500)
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6500)
await restoreWindow()
console.log('AFTER_RESAVE_RELOAD=' + JSON.stringify(await page.evaluate(BLOCKS)))

// ② 打印版式体检:模拟 print 媒体 + body.approval-printing(与侧栏「打印」同一个类)
await page.evaluate(() => document.body.classList.add('approval-printing'))
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(300)
const printCss = await page.evaluate(() => {
  const cs = (sel, prop) => {
    const el = document.querySelector(sel)
    return el ? getComputedStyle(el)[prop] : '(无该元素)'
  }
  return {
    sheetVisibility: cs('.lp-sheet', 'visibility'),
    sheetPosition: cs('.lp-sheet', 'position'),
    sheetWidth: cs('.lp-sheet', 'width'),
    sheetBorder: cs('.lp-sheet', 'borderTopWidth'),
    gridWidth: cs('.lp-grid', 'width'),
    gridFontSize: cs('.lp-grid td', 'fontSize'),
    titleFontSize: cs('.lp-title', 'fontSize'),
    opDisplay: cs('.lp-op', 'display'),
    opColDisplay: cs('.lp-opcol', 'display'),
    sheetJitter: (() => {
      const el = document.querySelector('.lp-sheet')
      return el ? { scrollWidth: el.scrollWidth, offsetWidth: el.offsetWidth } : null
    })(),
  }
})
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
await page.evaluate(() => document.body.classList.remove('approval-printing'))
console.log('PRINT_MEDIA=' + JSON.stringify(printCss))

// ③ 新建第二张草稿:删光 3 块 → 空表「＋ 新增巡线记录」→ 点它补 1 块 → 填最小数据 → 保存
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').trim() === '新增')
  if (btn) btn.click()
})
await page.waitForTimeout(6000)
console.log('NEW_DRAFT=' + JSON.stringify(await page.evaluate(BLOCKS)))
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => {
    const ops = [...document.querySelectorAll('.lp-op .lp-btn')]
    if (ops[1]) ops[1].click() // 反复删第 1 块
  })
  await page.waitForTimeout(600)
}
console.log('AFTER_DEL_ALL=' + JSON.stringify(await page.evaluate(BLOCKS)))
await restoreWindow()
await page.screenshot({ path: out + '/round-04-02-empty-table.png' })
console.log('CLICK_ADD_LINK=' + (await page.evaluate(() => {
  const el = document.querySelector('.lp-addblock')
  if (!el) return false
  el.click()
  return true
})))
await page.waitForTimeout(1000)
console.log('AFTER_ADD_LINK=' + JSON.stringify(await page.evaluate(BLOCKS)))
// 填最小数据并保存(留一张 1 块的记录当证据;后面再用 ＋ 补回 3 块)
const fillNew = await page.evaluate(() => {
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
    '巡线时间': ['15:00'], '车间': ['成型一车间'], '编号1': ['CR-101'], '型号1': ['A-200'],
    '长度标准1': ['112.0'], '长度实测1': ['112.2'], '内径标准1': ['8.0'], '内径实测1': ['8.02'],
    '重量标准1': ['5.0'], '重量实测1': ['5.03'], '两液密度': ['1.02'], '表面状态': ['无粘模'],
    '跌落强度': ['合格'], '抗压强度': ['合格'], '结果判定': ['合格'], '巡线人员': ['赵六'],
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
console.log('FILL_NEW=' + JSON.stringify(fillNew))
await page.waitForTimeout(800)
await page.screenshot({ path: out + '/round-04-03-one-block-filled.png' })
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').trim() === '保存')
  if (btn) btn.click()
})
await page.waitForTimeout(7000)
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6500)
await restoreWindow()
console.log('AFTER_NEW_SAVE_RELOAD=' + JSON.stringify(await page.evaluate(BLOCKS)))
await page.screenshot({ path: out + '/round-04-04-second-doc-after-reload.png' })
console.log('DONE')
