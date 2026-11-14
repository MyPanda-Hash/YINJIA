// round-02 — A1 汇总/断言语义化(复用 round-01 已打开的新草稿页面)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]

const ev = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)]
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const sampleRows = q('.sample-row')
  const cols = q('.col-head .fi-colhead-text').map((e) => txt(e))
  const cells = sampleRows.map((tr) => [...tr.querySelectorAll('td')].map((td) => {
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
    slashText: cells.map((row) => row[ci].text === '/').filter(Boolean).length,
  }))
  const at = (ri, ci) => cells[ri][ci]
  return {
    hash: location.hash,
    colHeads: cols,
    sampleRowCount: sampleRows.length,
    sampleTdTotal: cells.flat().length,
    gzYCount: q('.sample-row td.gz-y').length,
    gzYColors: [...new Set(q('.sample-row td.gz-y').map((e) => getComputedStyle(e).backgroundColor))],
    slashCells: cells.flat().filter((c) => c.text === '/').length,
    fillableRows,
    fillableTotal: fillableRows.reduce((a, x) => a + x.rows.length, 0),
    stdCheckCount: q('.standard-row td.std-check').length,
    stdCheckColors: [...new Set(q('.standard-row td.std-check').map((e) => getComputedStyle(e).backgroundColor))],
    stdCheckHasCtrl: q('.standard-row td.std-check input, .standard-row td.std-check textarea').length,
    spot: {
      '3#外径(可填)': at(2, 2),
      '3#表观(不可填)': at(2, 0),
      '5#跌落(可填)': at(4, 6),
      '5#外径(不可填)': at(4, 2),
      '7#挤压(可填)': at(6, 7),
      '7#浊度(可填)': at(6, 8),
      '7#压降(可填)': at(6, 9),
      '1#表观(可填)': at(0, 0),
      '1#跌落(不可填)': at(0, 6),
      '8#表观(不可填)': at(7, 0),
    },
  }
})
await fs.writeFile(OUT + '/a1-evidence.json', JSON.stringify(ev, null, 1), 'utf8')
console.log('SUMMARY=' + JSON.stringify({
  hash: ev.hash,
  cols: ev.colHeads,
  sampleRows: ev.sampleRowCount,
  tdTotal: ev.sampleTdTotal,
  gzY: ev.gzYCount,
  gzYColors: ev.gzYColors,
  slash: ev.slashCells,
  fillableTotal: ev.fillableTotal,
  fillableRows: ev.fillableRows.map((x) => x.col + ':' + x.rows.join('/')),
  stdCheck: ev.stdCheckCount,
  stdCheckColors: ev.stdCheckColors,
  stdCheckHasCtrl: ev.stdCheckHasCtrl,
}, null, 1))
console.log('SPOT=' + JSON.stringify(ev.spot, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) {}
await page.screenshot({ path: OUT + '/round-02-first-insp-full.png', fullPage: true })
console.log('DONE round-02')
