// round-40 — 第十一轮补验:挤压强度 5#/6#。5173(测试库) 新建草稿 DOM 矩阵 + 填 compress@5# 保存
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')

// 上一轮任务空间已关闭 ⇒ 本轮新开一个(名字带 r11,避免与已关闭空间重名)
const task = await taskSpace('verify-20261114-r11')
const page = (await task.pages())[0] || await task.newPage()

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
  // 选登录工厂 YJ_TEST
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.el-select')].find((s) => (s.textContent || '').includes('请选择登录工厂') || (s.textContent || '').includes('正在加载工厂'))
    if (sel) sel.click()
  })
  await page.waitForTimeout(1000)
  const opts = await page.evaluate(() => {
    const os = [...document.querySelectorAll('.el-select-dropdown__item')].filter((o) => o.offsetParent !== null)
    os.forEach((o, i) => { o.id = 'lf-' + i })
    return os.map((o, i) => ({ i, t: (o.textContent || '').trim() }))
  })
  console.log('LOGIN_FACTORY_OPTS=' + JSON.stringify(opts))
  const testIdx = opts.find((o) => /测试/.test(o.t))
  if (testIdx) { try { await page.click('#lf-' + testIdx.i, { label: '测试库' }) } catch (e) { console.log('pick err ' + e.message) } }
  await page.waitForTimeout(600)
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
  return true
}

await page.goto('http://localhost:5173/', { timeout: 60000 })
await page.waitForTimeout(3500)
await loginIfNeeded()
await page.evaluate(() => { try { localStorage.setItem('mes_locale', 'zh-CN') } catch (e) {} })
await page.waitForTimeout(2000)
let st = await page.evaluate(() => ({ factory: (document.querySelector('.factory-name')?.textContent || '').trim(), hash: location.hash }))
console.log('STATE0=' + JSON.stringify(st))
// 若还在正式库:真实点击切到测试库
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

// 打开首件检验单面板
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 40000 })
await page.waitForTimeout(8000)

// 选生产工单生成草稿(直接点;若侧栏无按钮先点新增)
const pickClicked = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => txt(e) === '选生产工单')
  if (b) b.click()
  return !!b
})
console.log('PICK_CLICKED=' + pickClicked)
await page.waitForTimeout(4000)
let pick = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = dlg ? [...dlg.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
  return { dialog: !!dlg, tip: txt(dlg?.querySelector('.wopick-tip')), rowCount: rows.length, first: rows[0] ? txt(rows[0]).slice(0, 120) : null }
})
console.log('PICK=' + JSON.stringify(pick))
if (!pick.dialog) {
  await page.evaluate(() => {
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const b = [...document.querySelectorAll('.as-side-btn')].find((e) => txt(e) === '新增')
    if (b) b.click()
  })
  await page.waitForTimeout(6000)
  await page.evaluate(() => {
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const b = [...document.querySelectorAll('.as-side-btn')].find((e) => txt(e) === '选生产工单')
    if (b) b.click()
  })
  await page.waitForTimeout(4000)
  pick = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const rows = dlg ? [...dlg.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
    return { dialog: !!dlg, rowCount: rows.length, first: rows[0] ? txt(rows[0]).slice(0, 120) : null }
  })
  console.log('PICK_RETRY=' + JSON.stringify(pick))
}
// 选第一行 → 确定
const chosen = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!dlg) return false
  const row = dlg.querySelector('.el-table__body-wrapper tbody tr')
  if (!row) return false
  row.click()
  return true
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const btn = dlg && [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').replace(/\s+/g, ' ').trim() === '确定')
  if (btn && !btn.disabled) btn.click()
})
console.log('CHOSEN=' + chosen)
await page.waitForTimeout(9000)
// 未保存提示(空草稿) → 不保存
const dlgTxt = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return d ? (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) : null
})
console.log('GUARD_DIALOG=' + JSON.stringify(dlgTxt))
if (dlgTxt && dlgTxt.includes('未保存')) {
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const b = d && [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '不保存')
    if (b) b.click()
  })
  await page.waitForTimeout(8000)
}

// —— DOM 矩阵取证(第十一轮:挤压 5/6) ——
const dom = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.sample-row')]
  const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => txt(e))
  const cells = rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => {
    const titleEl = td.querySelector('[title]')
    return {
      bg: getComputedStyle(td).backgroundColor,
      hasInput: !!td.querySelector('input,textarea'),
      boxes: td.querySelectorAll('.fi-box').length,
      text: txt(td),
      title: titleEl ? (titleEl.getAttribute('title') || '') : '',
    }
  }))
  const fillableRows = cols.map((c, ci) => ({
    col: c,
    rows: cells.map((row, ri) => ((row[ci].hasInput || row[ci].boxes > 0) ? ri + 1 : null)).filter(Boolean),
  }))
  const ci = (kw) => cols.findIndex((c) => (c || '').includes(kw))
  const at = (ri, c) => cells[ri][c]
  const compressCol = ci('挤压')
  return {
    hash: location.hash,
    cols,
    compressCol,
    sampleRows: rows.length,
    gzY: document.querySelectorAll('.sample-row td.gz-y').length,
    gzYColor: (() => { const e = document.querySelector('.sample-row td.gz-y'); return e ? getComputedStyle(e).backgroundColor : null })(),
    slash: cells.flat().filter((c) => c.text === '/').length,
    stdCheck: document.querySelectorAll('.standard-row td.std-check').length,
    stdColor: (() => { const e = document.querySelector('.standard-row td.std-check'); return e ? getComputedStyle(e).backgroundColor : null })(),
    fillableRows,
    fillableTotal: fillableRows.reduce((a, x) => a + x.rows.length, 0),
    compressRows: fillableRows[compressCol] ? fillableRows[compressCol].rows : null,
    compress5: at(4, compressCol),
    compress6: at(5, compressCol),
    compress7: at(6, compressCol),
    compress8: at(7, compressCol),
    dropRows: fillableRows[ci('跌落')] ? fillableRows[ci('跌落')].rows : null,
    turbRows: fillableRows[ci('浊度')] ? fillableRows[ci('浊度')].rows : null,
    pressRows: fillableRows[ci('压降')] ? fillableRows[ci('压降')].rows : null,
  }
})
console.log('DOM=' + JSON.stringify(dom, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-40-r11-dom-5173.png', fullPage: true })

// —— 填 挤压强度 5# = 32.5 → 保存 ——
const filled = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.sample-row')]
  const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => txt(e))
  const ci = cols.findIndex((c) => (c || '').includes('挤压'))
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const inp5 = rows[4].querySelectorAll('td')[ci].querySelector('input')
  const inp7 = rows[6].querySelectorAll('td')[ci].querySelector('input')
  const out = { colIndex: ci }
  if (inp5) { setVal(inp5, '32.5'); out.v5 = inp5.value } else out.v5 = 'NO_INPUT'
  out.v7HasInput = !!inp7
  return out
})
console.log('FILLED=' + JSON.stringify(filled))
await page.waitForTimeout(800)
await page.evaluate(() => {
  window.__msgs = []
  new MutationObserver(() => {
    document.querySelectorAll('.el-message').forEach((m) => {
      const t = (m.textContent || '').replace(/\s+/g, ' ').trim()
      if (t && !window.__msgs.includes(t)) window.__msgs.push(t)
    })
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '保存')
  if (b) b.click()
})
await page.waitForTimeout(9000)
const afterSave = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    msgs: window.__msgs || [],
    docNos: (document.body.innerText || '').match(/SJ-\d{4}-\d{2}-\d{4}/g)?.slice(0, 6) || [],
    rail: [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 4).map((x) => txt(x)),
    fiHead: txt(document.querySelector('.fi-head')),
  }
})
console.log('AFTER_SAVE=' + JSON.stringify(afterSave, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-40-r11-saved.png', fullPage: true })
await fs.writeFile(OUT + '/r11-dom-save.json', JSON.stringify({ st, pick, chosen, dom, filled, afterSave }, null, 1), 'utf8')
console.log('DONE round-40')
