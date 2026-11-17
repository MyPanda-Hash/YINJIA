// round-04 — A2 定位:抓保存请求 payload/响应,查明细为何 0 行
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

// 回到首件检验单列表并新建草稿
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 40000 })
await page.waitForTimeout(5000)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '新增')
  if (b) b.click()
})
await page.waitForTimeout(5000)

// 装请求抓包 + 消息抓包
await page.evaluate(() => {
  window.__reqs = []
  if (!window.__xhrPatched) {
    window.__xhrPatched = true
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
            resp: (self.responseText || '').slice(0, 1200),
          })
        })
      } catch (e) {}
      return origSend.apply(this, arguments)
    }
  }
  window.__msgs = []
  if (!window.__msgPatched) {
    window.__msgPatched = true
    const obs = new MutationObserver(() => {
      document.querySelectorAll('.el-message').forEach((m) => {
        const t = (m.textContent || '').replace(/\s+/g, ' ').trim()
        if (t && !window.__msgs.includes(t)) window.__msgs.push(t)
      })
    })
    obs.observe(document.body, { childList: true, subtree: true, characterData: true })
  }
})

// 填值
const filled = await page.evaluate(() => {
  function setVal(el, v) {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const rows = [...document.querySelectorAll('.sample-row')]
  const cell = (ri, ci) => rows[ri].querySelectorAll('td')[ci]
  setVal(cell(2, 2).querySelector('input'), '12.3')
  setVal(cell(4, 6).querySelector('input'), '50cm')
  setVal(cell(6, 7).querySelector('input'), '31')
  return { v1: cell(2, 2).querySelector('input').value, v2: cell(4, 6).querySelector('input').value, v3: cell(6, 7).querySelector('input').value }
})
console.log('FILLED=' + JSON.stringify(filled))
await page.waitForTimeout(800)

// 点保存
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '保存')
  if (b) b.click()
})
await page.waitForTimeout(8000)
const dump = await page.evaluate(() => ({
  msgs: window.__msgs,
  reqs: window.__reqs.map((r) => ({ m: r.m, u: r.u, status: r.status, reqLen: (r.req || '').length, resp: (r.resp || '').slice(0, 600) })),
  fiHead: (document.querySelector('.fi-head')?.textContent || '').replace(/\s+/g, ' ').trim(),
  valuesAfter: (() => {
    const rows = [...document.querySelectorAll('.sample-row')]
    if (!rows.length) return null
    const cell = (ri, ci) => rows[ri].querySelectorAll('td')[ci]
    const v = (ri, ci) => { const td = cell(ri, ci); const i = td && td.querySelector('input'); return i ? i.value : null }
    return { v1: v(2, 2), v2: v(4, 6), v3: v(6, 7) }
  })(),
}))
await fs.writeFile(OUT + '/a2-save-wire.json', JSON.stringify(dump, null, 1), 'utf8')
console.log('MSGS=' + JSON.stringify(dump.msgs))
console.log('REQS=' + JSON.stringify(dump.reqs, null, 1))
console.log('AFTER_VALUES=' + JSON.stringify(dump.valuesAfter))
console.log('FIHEAD=' + JSON.stringify(dump.fiHead))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-04-after-save.png' })
console.log('DONE round-04')
