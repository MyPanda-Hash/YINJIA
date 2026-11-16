/* round-06:新增空白草稿 → 校验三行合并(标签/两个输入) + 纸面截图 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-module-20261116/'
const task = await taskSpace(1)
const page = (await task.pages())[0]

// 放大窗口,露出右侧审批侧栏
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', left: 0, top: 0, width: 1500, height: 1000 } })
} catch (e) { console.log('window resize skip: ' + e.message) }
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)

const sideBtns = await page.evaluate(() => [...document.querySelectorAll('.approval-side .as-side-btn, .approval-side button')].map((b) => (b.textContent || '').trim()))
console.log('sideBtns:', JSON.stringify(sideBtns))
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.approval-side .as-side-btn, .approval-side button')].find((x) => (x.textContent || '').trim().includes('新增'))
  if (!b) return false
  b.click(); return true
})
console.log('click 新增:', clicked)
await page.waitForTimeout(4500)

const paper = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.ic-grid tr')].map((tr) => {
    const th = tr.querySelector('th')
    const tds = [...tr.querySelectorAll('td')]
    return {
      th: (th?.innerText || '').replace(/\s+/g, ' ').trim(),
      tdCount: tds.length,
      inputs: [...tr.querySelectorAll('input, textarea')].map((i) => ({ ph: i.placeholder || '', val: i.value || '', tag: i.tagName })),
      text: tds.map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
    }
  })
  return {
    docNo: (document.querySelector('.ic-meta-no')?.innerText || '').replace(/\s+/g, ' ').trim(),
    rowCount: rows.length,
    partyRows: rows.slice(0, 4),
    allRows: rows.map((r) => r.th + ' | in=' + r.inputs.length),
  }
})
console.log('PAPER:', JSON.stringify(paper, null, 2))

// domToPng 整纸截图
async function shotPaper(file, scale = 1.3) {
  const url = await page.evaluate(async (sc) => {
    const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
    const el = document.querySelector('.ic-sheet')
    if (!el) return { err: 'no paper' }
    const w0 = Math.max(el.scrollWidth, el.offsetWidth)
    const h0 = Math.max(el.scrollHeight, el.offsetHeight)
    return await m.domToPng(el, { scale: sc, backgroundColor: '#ffffff', width: w0, height: h0 })
  }, scale)
  if (url.err) { console.log('SHOT FAIL', url.err); return }
  await fs.writeFile(OUT + file, Buffer.from(String(url).split(',')[1], 'base64'))
  console.log('shot', file)
}
await shotPaper('round-06-blank.png')
