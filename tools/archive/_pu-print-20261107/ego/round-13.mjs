// round-13:重开有金额弹窗 → 截图取证(多种 CDP 兜底) → 顺手把纸面 HTML 存成证据文件
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
const fs = await import('node:fs/promises')
await page.waitForTimeout(500)

// 打开「打印」主按钮 → 有金额弹窗
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-group .tb-main')].find((n) => (n.textContent || '').trim() === '打印')
  if (el) el.click()
})
await page.waitForTimeout(2500)

const state = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    open: !!root,
    title: txt(document.querySelector('.el-dialog__header')),
    headers: root ? [...root.querySelectorAll('.el-table__header th')].map(txt) : [],
    rows: root ? [...root.querySelectorAll('.el-table__body tbody tr')].slice(0, 2).map(txt) : [],
    foot: root ? txt(root.querySelector('.pup-foot')) : '',
  }
})
console.log('dialog=' + JSON.stringify(state, null, 2))

// 截屏:①普通 API ②原始 CDP fromSurface=false ③CDP 带 clip
let ok = ''
try {
  ok = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-13-dialog.png' })
  console.log('shot1=' + ok)
} catch (e) {
  console.log('shot1 fail: ' + e.message)
  for (const params of [
    { format: 'png', fromSurface: false },
    { format: 'png', fromSurface: true, captureBeyondViewport: false },
    { format: 'png', fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1200, height: 800, scale: 1 } },
  ]) {
    try {
      const res = await page.cdp('Page.captureScreenshot', params)
      const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-13-dialog.png'
      await fs.writeFile(p, Buffer.from(res.data, 'base64'))
      console.log('shot-ok ' + JSON.stringify(params) + ' -> ' + p)
      ok = p
      break
    } catch (e2) { console.log('shot fail ' + JSON.stringify(params) + ': ' + e2.message) }
  }
}

// 存一份"打印层 HTML"作证据(不打真打印机)
await page.evaluate(() => {
  window.__printCalls = 0
  if (!window.__origPrint) window.__origPrint = window.print
  window.print = () => { window.__printCalls += 1 }
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('确定并打印'))
  if (btn) btn.click()
})
await page.waitForTimeout(2200)
const html = await page.evaluate(() => {
  const host = document.getElementById('yj-print-host')
  return host ? host.innerHTML : ''
})
if (html) {
  const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-13-paper.html'
  await fs.writeFile(p, '<meta charset="utf-8">' + html)
  console.log('paper html saved=' + p + ' bytes=' + html.length)
} else console.log('no print host')
await page.evaluate(() => {
  if (window.__origPrint) window.print = window.__origPrint
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
})
