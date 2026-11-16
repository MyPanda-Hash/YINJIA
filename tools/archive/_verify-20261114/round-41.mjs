// round-41 — 续 round-40:看当前页状态 → 填 挤压5#=32.5 → 保存
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => (s.name || '').includes('verify-20261114-r11'))
const task = entry ? (entry.ownership === 'agent' ? await taskSpace(entry.id) : await takeOverTaskSpace(entry.id)) : await taskSpace('verify-20261114-r11')
const page = (await task.pages())[0]
console.log('URL=' + await page.url())
const st = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    hash: location.hash,
    factory: (document.querySelector('.factory-name')?.textContent || '').trim(),
    sheet: !!document.querySelector('.fi-grid'),
    editing: !!document.querySelector('.fi-sheet.is-editing'),
    sampleRows: document.querySelectorAll('.sample-row').length,
    gzY: document.querySelectorAll('.sample-row td.gz-y').length,
    editableInputs: document.querySelectorAll('.sample-row input').length,
    dialogs: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => txt(d).slice(0, 80)),
    rail: [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 4).map((x) => txt(x)),
    msgs: [...document.querySelectorAll('.el-message')].map((m) => txt(m)),
  }
})
console.log('STATE=' + JSON.stringify(st, null, 1))
try {
  const filled = await page.evaluate(() => {
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const rows = [...document.querySelectorAll('.sample-row')]
    const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => txt(e))
    const ci = cols.findIndex((c) => (c || '').includes('挤压'))
    const out = { ci, rows: rows.length, cols: cols.map((c) => c.slice(0, 8)) }
    if (!rows.length || ci < 0) return { ...out, err: 'no rows/col' }
    const td5 = rows[4] && rows[4].querySelectorAll('td')[ci]
    const inp5 = td5 && td5.querySelector('input')
    out.td5Found = !!td5
    out.inp5Found = !!inp5
    if (inp5) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(inp5, '32.5')
      inp5.dispatchEvent(new Event('input', { bubbles: true }))
      inp5.dispatchEvent(new Event('change', { bubbles: true }))
      out.v5 = inp5.value
    }
    return out
  })
  console.log('FILL=' + JSON.stringify(filled))
} catch (e) { console.log('FILL_ERR=' + e.message) }
await page.waitForTimeout(1000)
try {
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
} catch (e) { console.log('SAVE_ERR=' + e.message) }
await page.waitForTimeout(9000)
const after = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    msgs: window.__msgs || [],
    docNos: (document.body.innerText || '').match(/SJ-\d{4}-\d{2}-\d{4}/g)?.slice(0, 6) || [],
    rail: [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 4).map((x) => txt(x)),
    dialogs: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => txt(d).slice(0, 80)),
    valuesAfter: (() => {
      const rows = [...document.querySelectorAll('.sample-row')]
      const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => txt(e))
      const ci = cols.findIndex((c) => (c || '').includes('挤压'))
      const v = (ri) => { const td = rows[ri] && rows[ri].querySelectorAll('td')[ci]; if (!td) return null; const i = td.querySelector('input,textarea'); return i ? i.value : txt(td) }
      return { c5: v(4), c6: v(5), c7: v(6), c8: v(7) }
    })(),
  }
})
console.log('AFTER=' + JSON.stringify(after, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
try { await page.screenshot({ path: OUT + '/round-41-r11-saved.png', fullPage: true }) } catch (e) { console.log('SHOT_ERR=' + e.message) }
await fs.writeFile(OUT + '/r11-save2.json', JSON.stringify({ st, after }, null, 1), 'utf8')
console.log('DONE round-41')
