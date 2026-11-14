// round-42 — 5173 重开 SJ-2026-11-0010:第十一轮 DOM 矩阵结构化取证 + 截图
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => (s.name || '').includes('verify-20261114-r11'))
const task = entry && entry.ownership !== 'agent' ? await takeOverTaskSpace(entry.id) : await taskSpace('verify-20261114-r11')
const page = (await task.pages())[0]

await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 60000 })
await page.waitForTimeout(9000)
const opened = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('SJ-2026-11-0010'))
  if (tr) tr.click()
  return { ok: !!tr, rails: [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 3).map((x) => txt(x)) }
})
console.log('OPEN=' + JSON.stringify(opened))
await page.waitForTimeout(7000)
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
  const cIdx = ci('挤压')
  const value = (ri, cIdx2) => { const td = rows[ri] && rows[ri].querySelectorAll('td')[cIdx2]; if (!td) return null; const i = td.querySelector('input,textarea'); return i ? i.value : txt(td) }
  return {
    hash: location.hash,
    factory: (document.querySelector('.factory-name')?.textContent || '').trim(),
    cols,
    sampleRows: rows.length,
    gzY: document.querySelectorAll('.sample-row td.gz-y').length,
    gzYColor: (() => { const e = document.querySelector('.sample-row td.gz-y'); return e ? getComputedStyle(e).backgroundColor : null })(),
    slash: cells.flat().filter((c2) => c2.text === '/').length,
    stdCheck: document.querySelectorAll('.standard-row td.std-check').length,
    stdColor: (() => { const e = document.querySelector('.standard-row td.std-check'); return e ? getComputedStyle(e).backgroundColor : null })(),
    fillableRows,
    fillableTotal: fillableRows.reduce((a, x) => a + x.rows.length, 0),
    compressRows: fillableRows[cIdx] ? fillableRows[cIdx].rows : null,
    compressCells: {
      '5#': at(4, cIdx), '6#': at(5, cIdx), '7#': at(6, cIdx), '8#': at(7, cIdx),
    },
    compressValues: { '5#': value(4, cIdx), '6#': value(5, cIdx), '7#': value(6, cIdx), '8#': value(7, cIdx) },
    dropRows: fillableRows[ci('跌落')] ? fillableRows[ci('跌落')].rows : null,
    turbRows: fillableRows[ci('浊度')] ? fillableRows[ci('浊度')].rows : null,
    pressRows: fillableRows[ci('压降')] ? fillableRows[ci('压降')].rows : null,
    otherRows: {
      appearance: fillableRows[ci('表观')]?.rows, depowder: fillableRows[ci('脱粉')]?.rows,
      outer: fillableRows[ci('外径')]?.rows, inner: fillableRows[ci('内径')]?.rows,
      length: fillableRows[ci('长度')]?.rows, weight: fillableRows[ci('重量')]?.rows,
    },
  }
})
console.log('DOM=' + JSON.stringify(dom, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) {}
await page.screenshot({ path: OUT + '/round-42-r11-dom-5173.png', fullPage: true })
await fs.writeFile(OUT + '/r11-dom.json', JSON.stringify({ opened, dom }, null, 1), 'utf8')
console.log('DONE round-42')
