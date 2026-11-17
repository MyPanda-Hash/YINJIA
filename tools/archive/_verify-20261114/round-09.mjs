// round-09 — 关掉「未保存提示」→ 切到新单 SJ-2026-11-0011 → 填黄格 → 保存
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

// 1. 点「不保存」(丢弃 0010 的脏改动,继续切到 0011)
const discard = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!dlg) return { ok: false, why: 'no dialog' }
  const btns = [...dlg.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim())
  const b = [...dlg.querySelectorAll('button')].find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === '不保存')
  if (b) b.click()
  return { ok: !!b, btns }
})
console.log('DISCARD=' + JSON.stringify(discard))
await page.waitForTimeout(7000)
const afterDiscard = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    dialogs: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).length,
    firstListNos: [...document.querySelectorAll('.a-left.dsr-no')].slice(0, 4).map((e) => txt(e)),
    editing: !!document.querySelector('.fi-sheet.is-editing'),
    msgs: (window.__msgs || []).slice(-6),
    headInputLabels: [...document.querySelectorAll('.fi-head input')].length,
  }
})
console.log('AFTER_DISCARD=' + JSON.stringify(afterDiscard))

// 2. 装抓包(保存请求 + 提示消息)
await page.evaluate(() => {
  window.__reqs = []
  window.__msgs = []
  const origOpen = XMLHttpRequest.prototype.open
  const origSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; return origOpen.apply(this, arguments) }
  XMLHttpRequest.prototype.send = function (body) {
    const self = this
    try {
      self.addEventListener('load', () => {
        window.__reqs.push({ m: self.__m, u: self.__u, status: self.status, req: typeof body === 'string' ? body : (body ? String(body) : ''), resp: (self.responseText || '').slice(0, 1500) })
      })
    } catch (e) {}
    return origSend.apply(this, arguments)
  }
  new MutationObserver(() => {
    document.querySelectorAll('.el-message').forEach((m) => {
      const t = (m.textContent || '').replace(/\s+/g, ' ').trim()
      if (t && !window.__msgs.includes(t)) window.__msgs.push(t)
    })
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
})

// 3. 填 3 个黄格
const filled = await page.evaluate(() => {
  function setVal(el, v) {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const rows = [...document.querySelectorAll('.sample-row')]
  const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => (e.textContent || '').trim())
  const ciOf = (kw) => cols.findIndex((c) => (c || '').includes(kw))
  const put = (sample, kw, v) => {
    const ci = ciOf(kw)
    const input = ci >= 0 ? rows[sample - 1].querySelectorAll('td')[ci].querySelector('input') : null
    if (!input) return 'NO_INPUT'
    setVal(input, v)
    return input.value
  }
  return { cols, '3#外径': put(3, '外径', '12.3'), '5#跌落': put(5, '跌落', '50cm'), '7#挤压': put(7, '挤压', '31') }
})
console.log('FILLED=' + JSON.stringify(filled))
await page.waitForTimeout(800)

// 4. 保存
const saveClicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '保存')
  if (b) b.click()
  return !!b
})
console.log('SAVE_CLICKED=' + saveClicked)
await page.waitForTimeout(9000)
const after = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.sample-row')]
  const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => txt(e))
  const ciOf = (kw) => cols.findIndex((c) => (c || '').includes(kw))
  const v = (ri, ci) => { const td = rows[ri] && rows[ri].querySelectorAll('td')[ci]; const el = td && td.querySelector('input,textarea'); return el ? el.value : (td ? txt(td) : null) }
  return {
    msgs: (window.__msgs || []),
    reqs: (window.__reqs || []).map((r) => ({ m: r.m, u: r.u, status: r.status, reqLen: (r.req || '').length, resp: (r.resp || '').slice(0, 600) })),
    firstListNos: [...document.querySelectorAll('.a-left.dsr-no')].slice(0, 4).map((e) => txt(e)),
    dialogs: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => txt(d.querySelector('.el-dialog__title'))),
    values: { v3outer: v(2, ciOf('外径')), v5drop: v(4, ciOf('跌落')), v7press: v(6, ciOf('挤压')) },
  }
})
await fs.writeFile(OUT + '/a2-save-wire3.json', JSON.stringify(after, null, 1), 'utf8')
console.log('AFTER_SAVE=' + JSON.stringify({
  msgs: after.msgs,
  firstListNos: after.firstListNos,
  dialogs: after.dialogs,
  values: after.values,
  reqs: after.reqs.map((r) => r.m + ' ' + String(r.u).slice(0, 80) + ' -> ' + r.status + ' len=' + r.reqLen + ' resp=' + (r.resp || '').slice(0, 200)),
}, null, 1))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-09-saved.png', fullPage: true })
console.log('DONE round-09')
