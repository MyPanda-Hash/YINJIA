// round-43 — 5173 DOM 矩阵取证(先落盘 JSON 再截图,避免截图异常丢证据)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => (s.name || '').includes('verify-20261114-r11'))
const task = entry && entry.ownership !== 'agent' ? await takeOverTaskSpace(entry.id) : await taskSpace(entry.id || 'verify-20261114-r11')
const page = (await task.pages())[0]
await page.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 60000 })
await page.waitForTimeout(9000)
const opened = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('SJ-2026-11-0010'))
  if (tr) tr.click()
  return { ok: !!tr }
})
await page.waitForTimeout(7000)
const dom = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const rows = [...document.querySelectorAll('.sample-row')]
  const cols = [...document.querySelectorAll('.col-head .fi-colhead-text')].map((e) => txt(e))
  const cells = rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => {
    const t = td.querySelector('[title]')
    return {
      bg: getComputedStyle(td).backgroundColor,
      hasInput: !!td.querySelector('input,textarea'),
      boxes: td.querySelectorAll('.fi-box').length,
      text: txt(td),
      title: t ? (t.getAttribute('title') || '') : '',
    }
  }))
  const fillableRows = cols.map((c, ci) => ({ col: c, rows: cells.map((row, ri) => ((row[ci].hasInput || row[ci].boxes > 0) ? ri + 1 : null)).filter(Boolean) }))
  const ci = (kw) => cols.findIndex((c) => (c || '').includes(kw))
  const cIdx = ci('挤压')
  const at = (ri, c) => cells[ri][c]
  const value = (ri, c) => { const td = rows[ri] && rows[ri].querySelectorAll('td')[c]; if (!td) return null; const i = td.querySelector('input,textarea'); return i ? i.value : txt(td) }
  return {
    hash: location.hash,
    factory: (document.querySelector('.factory-name')?.textContent || '').trim(),
    cols,
    sampleRows: rows.length,
    gzY: document.querySelectorAll('.sample-row td.gz-y').length,
    gzYColors: [...new Set([...document.querySelectorAll('.sample-row td.gz-y')].map((e) => getComputedStyle(e).backgroundColor))],
    slash: cells.flat().filter((c2) => c2.text === '/').length,
    stdCheck: document.querySelectorAll('.standard-row td.std-check').length,
    stdColors: [...new Set([...document.querySelectorAll('.standard-row td.std-check')].map((e) => getComputedStyle(e).backgroundColor))],
    stdCheckControls: document.querySelectorAll('.standard-row td.std-check input, .standard-row td.std-check textarea').length,
    fillableRows,
    fillableTotal: fillableRows.reduce((a, x) => a + x.rows.length, 0),
    compressRows: fillableRows[cIdx] ? fillableRows[cIdx].rows : null,
    compressCells: { '5#': at(4, cIdx), '6#': at(5, cIdx), '7#': at(6, cIdx), '8#': at(7, cIdx) },
    compressValues: { '5#': value(4, cIdx), '6#': value(5, cIdx), '7#': value(6, cIdx), '8#': value(7, cIdx) },
    dropRows: fillableRows[ci('跌落')] ? fillableRows[ci('跌落')].rows : null,
    turbRows: fillableRows[ci('浊度')] ? fillableRows[ci('浊度')].rows : null,
    pressRows: fillableRows[ci('压降')] ? fillableRows[ci('压降')].rows : null,
    appearanceRows: fillableRows[ci('表观')]?.rows,
    depowderRows: fillableRows[ci('脱粉')]?.rows,
    outerRows: fillableRows[ci('外径')]?.rows,
    innerRows: fillableRows[ci('内径')]?.rows,
    lengthRows: fillableRows[ci('长度')]?.rows,
    weightRows: fillableRows[ci('重量')]?.rows,
  }
})
await fs.writeFile(OUT + '/r11-dom.json', JSON.stringify({ opened, dom }, null, 1), 'utf8')
console.log('SAVED r11-dom.json')
console.log('SUMMARY=' + JSON.stringify({ hash: dom.hash, factory: dom.factory, cols: dom.cols, gzY: dom.gzY, gzYColors: dom.gzYColors, slash: dom.slash, stdCheck: dom.stdCheck, stdColors: dom.stdColors, stdCheckControls: dom.stdCheckControls, fillableTotal: dom.fillableTotal, fillableRows: dom.fillableRows.map((x) => x.col + ':' + x.rows.join('/')), compressRows: dom.compressRows, compressValues: dom.compressValues, compress7: dom.compressCells['7#'], compress8: dom.compressCells['8#'], drop: dom.dropRows, turb: dom.turbRows, press: dom.pressRows, appearance: dom.appearanceRows, depowder: dom.depowderRows, outer: dom.outerRows, inner: dom.innerRows, length: dom.lengthRows, weight: dom.weightRows }, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
  await page.screenshot({ path: OUT + '/round-43-r11-dom-5173.png', fullPage: true })
  console.log('SHOT_OK')
} catch (e) { console.log('SHOT_ERR=' + (e && e.message)) }
console.log('DONE round-43')
