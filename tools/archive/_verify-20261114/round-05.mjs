// round-05 — A2 正路:选生产工单 → 填黄格 → 保存,抓请求/单号
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}

// —— 1. 点「选生产工单」 ——
const clickPick = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '选生产工单')
  if (b) b.click()
  return !!b
})
console.log('PICK_CLICKED=' + clickPick)
await page.waitForTimeout(4000)
const pick = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = dlg ? [...dlg.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
  return {
    dialog: !!dlg,
    tip: txt(dlg?.querySelector('.wopick-tip')),
    gate: txt(dlg?.querySelector('.wopick-gate')),
    headers: dlg ? [...dlg.querySelectorAll('.el-table__header-wrapper th')].map((e) => txt(e)).filter(Boolean) : [],
    rowCount: rows.length,
    rows: rows.slice(0, 4).map((r) => txt(r)),
    footerBtns: dlg ? [...dlg.querySelectorAll('.el-dialog__footer button')].map((b) => ({ text: txt(b), disabled: b.disabled })) : [],
  }
})
console.log('PICK=' + JSON.stringify(pick, null, 1))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-05-picker.png' })

// —— 2. 选中第一行 → 确定 ——
const chosen = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!dlg) return { ok: false, why: 'no dialog' }
  const row = dlg.querySelector('.el-table__body-wrapper tbody tr')
  if (!row) return { ok: false, why: 'no row' }
  const td = [...row.querySelectorAll('td')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  row.click()
  return { ok: true, td }
})
console.log('CHOSEN=' + JSON.stringify(chosen))
await page.waitForTimeout(800)
const confirmed = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!dlg) return { ok: false, why: 'no dialog' }
  const btn = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').replace(/\s+/g, ' ').trim() === '确定')
  if (!btn) return { ok: false, why: 'no confirm' }
  if (btn.disabled) return { ok: false, why: 'disabled' }
  btn.click()
  return { ok: true }
})
console.log('CONFIRMED=' + JSON.stringify(confirmed))
await page.waitForTimeout(8000)

// —— 3. 抓包脚本(若页面没刷新,抓包仍在) ——
const beforeFill = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const docNos = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length > 3) continue
    const t = txt(el)
    if (/^SJ-\d{4}-\d{2}-\d{4}$/.test(t)) docNos.push({ text: t, tag: el.tagName, cls: el.className })
  }
  return {
    hash: location.hash,
    dialogClosed: ![...document.querySelectorAll('.el-dialog')].some((x) => x.offsetParent !== null),
    sheet: !!document.querySelector('.fi-grid'),
    editable: !!document.querySelector('.sample-row input, .sample-row textarea'),
    gzY: document.querySelectorAll('.sample-row td.gz-y').length,
    headLabels: [...document.querySelectorAll('.fi-head label, .fi-head .el-form-item__label')].map((e) => txt(e)),
    docNos: docNos.slice(0, 6),
    bodyDocNoHits: ((document.body.innerText || '').match(/SJ-\d{4}-\d{2}-\d{4}/g) || []).slice(0, 6),
    stdRowTexts: [...document.querySelectorAll('.standard-row td')].map((td) => txt(td)),
    inputCount: document.querySelectorAll('.sample-row input').length,
    msgs: (window.__msgs || []).slice(-5),
  }
})
console.log('AFTER_PICK=' + JSON.stringify(beforeFill, null, 1))

// —— 4. 填 3 个黄格 ——
const filled = await page.evaluate(() => {
  function setVal(el, v) {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const rows = [...document.querySelectorAll('.sample-row')]
  const cell = (ri, ci) => rows[ri].querySelectorAll('td')[ci]
  // 按列名定位(列序与契约一致,但用表头再兜一次)
  const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => (e.textContent || '').trim())
  const ciOf = (kw) => cols.findIndex((c) => (c || '').includes(kw))
  const out = { cols }
  const put = (sample, kw, v, key) => {
    const ci = ciOf(kw)
    const input = ci >= 0 ? cell(sample - 1, ci).querySelector('input') : null
    if (!input) { out[key] = 'NO_INPUT(ci=' + ci + ')'; return }
    setVal(input, v)
    out[key] = input.value
  }
  put(3, '外径', '12.3', '3#外径')
  put(5, '跌落', '50cm', '5#跌落')
  put(7, '挤压', '31', '7#挤压')
  return out
})
console.log('FILLED=' + JSON.stringify(filled))
await page.waitForTimeout(1000)

// —— 5. 重新装抓包(页面可能已重载,__reqs 可能丢) ——
await page.evaluate(() => {
  window.__reqs = []
  if (!window.__xhrPatched2) {
    window.__xhrPatched2 = true
    const origOpen = XMLHttpRequest.prototype.open
    const origSend = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; return origOpen.apply(this, arguments) }
    XMLHttpRequest.prototype.send = function (body) {
      const self = this
      try {
        self.addEventListener('load', () => {
          window.__reqs.push({
            m: self.__m, u: self.__u, status: self.status,
            req: typeof body === 'string' ? body : (body ? String(body) : ''),
            resp: (self.responseText || '').slice(0, 1500),
          })
        })
      } catch (e) {}
      return origSend.apply(this, arguments)
    }
  }
  window.__msgs = window.__msgs || []
  if (!window.__msgPatched2) {
    window.__msgPatched2 = true
    new MutationObserver(() => {
      document.querySelectorAll('.el-message').forEach((m) => {
        const t = (m.textContent || '').replace(/\s+/g, ' ').trim()
        if (t && !window.__msgs.includes(t)) window.__msgs.push(t)
      })
    }).observe(document.body, { childList: true, subtree: true, characterData: true })
  }
})

// —— 6. 保存 ——
const saveClicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '保存')
  if (b) b.click()
  return !!b
})
console.log('SAVE_CLICKED=' + saveClicked)
await page.waitForTimeout(9000)
const after = await page.evaluate(() => ({
  msgs: (window.__msgs || []),
  reqs: (window.__reqs || []).map((r) => ({ m: r.m, u: r.u, status: r.status, reqLen: (r.req || '').length, resp: (r.resp || '').slice(0, 800) })),
  bodyDocNoHits: ((document.body.innerText || '').match(/SJ-\d{4}-\d{2}-\d{4}/g) || []).slice(0, 8),
  fiHead: (document.querySelector('.fi-head')?.textContent || '').replace(/\s+/g, ' ').trim(),
  valuesAfter: (() => {
    const rows = [...document.querySelectorAll('.sample-row')]
    if (!rows.length) return null
    const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => (e.textContent || '').trim())
    const ciOf = (kw) => cols.findIndex((c) => (c || '').includes(kw))
    const v = (ri, ci) => { const td = rows[ri] && rows[ri].querySelectorAll('td')[ci]; const i = td && td.querySelector('input,textarea'); return i ? i.value : (td ? (td.textContent || '').trim() : null) }
    return { v3outer: v(2, ciOf('外径')), v5drop: v(4, ciOf('跌落')), v7press: v(6, ciOf('挤压')) }
  })(),
}))
await fs.writeFile(OUT + '/a2-save-wire2.json', JSON.stringify(after, null, 1), 'utf8')
console.log('AFTER_SAVE=' + JSON.stringify({ msgs: after.msgs, docNos: after.bodyDocNoHits, fiHead: after.fiHead, values: after.valuesAfter, reqs: after.reqs.map((r) => r.m + ' ' + String(r.u).slice(0, 90) + ' -> ' + r.status + ' resp=' + (r.resp || '').slice(0, 160)), }, null, 1))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-05-saved.png', fullPage: true })
console.log('DONE round-05')
