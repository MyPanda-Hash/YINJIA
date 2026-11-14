// round-03: 定位「按这次打印打码」点了没生效的原因(抓 puPrintDetail 的请求/响应与提示)
const fs = await import('node:fs/promises')
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)

await page.evaluate(() => {
  window.__probe = []
  window.__msgs = []
  const open = XMLHttpRequest.prototype.open
  const send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u, ...r) { this.__u = u; this.__m = m; return open.call(this, m, u, ...r) }
  XMLHttpRequest.prototype.send = function (b) {
    this.addEventListener('load', () => {
      try { window.__probe.push({ url: this.__u, status: this.status, body: String(this.responseText || '').slice(0, 400) }) } catch (e) { /* ignore */ }
    })
    return send.call(this, b)
  }
  new MutationObserver(() => {
    document.querySelectorAll('.el-message__content').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (t && window.__msgs[window.__msgs.length - 1] !== t) window.__msgs.push(t)
    })
  }).observe(document.body, { childList: true, subtree: true })
})

const before = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...(d?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.textContent || '').trim())
  const qtyIdx = heads.findIndex((h) => h.includes('本次打印数量'))
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const row0 = d?.querySelectorAll('.el-table__body tbody tr')[0]
  return {
    qty: row0?.querySelectorAll('td')[qtyIdx]?.querySelector('input')?.value ?? null,
    box: row0?.querySelectorAll('td')[boxIdx]?.querySelector('input')?.value ?? null,
    banner: (d?.querySelector('.mlq-lock')?.textContent || '').trim(),
  }
})
console.log('BEFORE ' + JSON.stringify(before))

// 完整鼠标事件序列点「按这次打印打码」
const clicked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const po = [...(d?.querySelectorAll('.el-collapse-item') || [])].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const btn = po ? [...po.querySelectorAll('button')].find((b) => (b.textContent || '').includes('按这次打印打码')) : null
  if (!btn) return { ok: false }
  btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true, text: (btn.textContent || '').trim(), cls: (btn.className || '').toString().slice(0, 80) }
})
console.log('CLICK ' + JSON.stringify(clicked))
await page.waitForTimeout(6000)

const after = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...(d?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.textContent || '').trim())
  const qtyIdx = heads.findIndex((h) => h.includes('本次打印数量'))
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const rows = [...(d?.querySelectorAll('.el-table__body tbody tr') || [])].map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    const q = tds[qtyIdx]?.querySelector('input')
    const b = tds[boxIdx]?.querySelector('input')
    return q || b ? { qty: q?.value ?? null, qtyDisabled: q?.disabled ?? null, box: b?.value ?? null, boxDisabled: b?.disabled ?? null } : null
  }).filter(Boolean)
  return {
    rows,
    banner: (d?.querySelector('.mlq-lock')?.textContent || '').replace(/\s+/g, ' ').trim(),
    cancelBtn: [...(d?.querySelectorAll('button') || [])].some((b) => (b.textContent || '').includes('取消带入')),
    msgs: window.__msgs,
    probe: (window.__probe || []).filter((p) => /puPrint|label/i.test(p.url || '')),
  }
})
console.log('AFTER ' + JSON.stringify(after, null, 2))
await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-03.json', JSON.stringify({ before, clicked, after }, null, 2), 'utf8')
