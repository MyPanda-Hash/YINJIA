// round-18: 补齐必填后真点「审核」:币种=人民币、汇率=1、明细「仓库」按行定位填第一个仓。
// 同时给 XHR 装探针,把 /px/callButton 的响应原文抓下来。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.waitForTimeout(400)

await page.evaluate(() => {
  window.__probe = []
  window.__msgs = []
  const open = XMLHttpRequest.prototype.open
  const send = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__u = u; this.__m = m; return open.call(this, m, u, ...rest) }
  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener('load', () => {
      try { window.__probe.push({ url: this.__u, status: this.status, body: String(this.responseText || '').slice(0, 800), req: String(body || '').slice(0, 400) }) } catch (e) { /* ignore */ }
    })
    return send.call(this, body)
  }
  new MutationObserver(() => {
    document.querySelectorAll('.el-message__content').forEach((el) => {
      const t = (el.textContent || '').trim()
      if (t && window.__msgs[window.__msgs.length - 1] !== t) window.__msgs.push(t)
    })
  }).observe(document.body, { childList: true, subtree: true })
})

// ① 币种 = 人民币
await page.evaluate(() => {
  const f = [...document.querySelectorAll('.header-fields .field')]
    .find((x) => (x.querySelector('label')?.textContent || '').trim() === '币种')
  f?.querySelector('.el-select__wrapper')?.click()
})
await page.waitForTimeout(900)
const currency = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const it = items.find((el) => /人民币|美金|RMB|元/.test(el.textContent || ''))
  if (!it) return items.map((el) => (el.textContent || '').trim()).join(',')
  it.click()
  return (it.textContent || '').trim()
})
console.log('CURRENCY ' + currency)
await page.waitForTimeout(600)

// ② 明细第1行「仓库」:按"行里含 YJ-XH-002"定位,再取同列序号的 td
const wh = await page.evaluate(() => {
  const tables = [...document.querySelectorAll('table')]
  for (const t of tables) {
    const ths = [...t.querySelectorAll('thead th')].map((th) => (th.textContent || '').trim())
    const col = ths.findIndex((x) => x.startsWith('仓库'))
    if (col < 0) continue
    const row = [...t.querySelectorAll('tbody tr')].find((tr) => (tr.textContent || '').includes('YJ-XH-002'))
    if (!row) continue
    const td = row.querySelectorAll('td')[col]
    if (!td) continue
    const sel = td.querySelector('.el-select__wrapper')
    if (sel) { sel.click(); return { mode: 'select', col, ths: ths.slice(0, 20) } }
    return { mode: 'plain', col, html: td.innerHTML.slice(0, 200) }
  }
  return { mode: 'not-found' }
})
console.log('WAREHOUSE ' + JSON.stringify(wh))
if (wh.mode === 'select') {
  await page.waitForTimeout(900)
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((el) => el.offsetParent && (el.textContent || '').trim())
    const it = items[items.length - 1]
    it?.click()
    return (it?.textContent || '').trim()
  })
  console.log('WAREHOUSE_PICKED ' + picked)
  await page.waitForTimeout(600)
}

// ③ 点「审核」→ 确认
await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '审核')
  g?.querySelector('.tb-main')?.click()
})
await page.waitForTimeout(2000)
const box = await page.evaluate(() => {
  const b = document.querySelector('.el-message-box')
  return b ? { text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240) } : null
})
console.log('BOX ' + JSON.stringify(box))
if (box && /人工审核确认/.test(box.text)) {
  await page.evaluate(() => {
    const ta = document.querySelector('.el-message-box textarea')
    if (ta) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      s.call(ta, '【验收】审核按钮直审(测试账套)')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const btn = [...document.querySelectorAll('.el-message-box__btns button')].find((b) => (b.textContent || '').includes('确认审核'))
    btn?.click()
  })
  await page.waitForTimeout(9000)
}
const out = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    status: text(document.querySelector('.doc-status')),
    foot: text(document.querySelector('.doc-foot, .foot-line, .approval-foot')),
    msgs: window.__msgs,
    calls: (window.__probe || []).map((p) => ({ url: p.url, status: p.status, body: p.body.slice(0, 200), req: p.req.slice(0, 200) })),
  }
})
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-18.json', JSON.stringify(out, null, 2), 'utf8')
console.log('STATUS ' + out.status + ' msgs=' + JSON.stringify(out.msgs) + ' calls=' + out.calls.length)
