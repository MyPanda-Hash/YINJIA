// round-12: 同上,但给 XHR 装探针,把 /px/button 的请求与响应原文抓下来,定位"点了没反应"。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(500)

await page.evaluate(() => {
  window.__probe = []
  const open = XMLHttpRequest.prototype.open
  const send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__u = u; this.__m = m; return open.call(this, m, u, ...rest) }
  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener('load', () => {
      try {
        window.__probe.push({ url: this.__u, method: this.__m, status: this.status, body: String(this.responseText || '').slice(0, 600), req: String(body || '').slice(0, 600) })
      } catch (e) { /* ignore */ }
    })
    return send.call(this, body)
  }
  window.__msgs = []
  const mo = new MutationObserver(() => {
    document.querySelectorAll('.el-message__content').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (t && window.__msgs[window.__msgs.length - 1] !== t) window.__msgs.push(t)
    })
  })
  mo.observe(document.body, { childList: true, subtree: true })
})

await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '审核')
  g?.querySelector('.tb-main')?.click()
})
await page.waitForTimeout(2000)
const clickedConfirm = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.el-message-box__btns button')].map((b) => (b.textContent || '').trim())
  const btn = [...document.querySelectorAll('.el-message-box__btns button')].find((b) => (b.textContent || '').includes('确认审核'))
  if (!btn) return { ok: false, btns }
  btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  btn.click()
  return { ok: true, btns }
})
console.log('CONFIRM ' + JSON.stringify(clickedConfirm))
await page.waitForTimeout(9000)

const out = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    doc: text(document.querySelector('.doc-chip')),
    status: text(document.querySelector('.doc-status')),
    msgs: window.__msgs,
    probe: (window.__probe || []).filter((p) => /\/px\/button|saveForm|audit/i.test(p.url || '')),
    boxOpen: !!document.querySelector('.el-message-box'),
  }
})
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-12.json', JSON.stringify(out, null, 2), 'utf8')
console.log('STATUS ' + out.status + ' msgs=' + JSON.stringify(out.msgs) + ' boxOpen=' + out.boxOpen + ' calls=' + out.probe.length)
