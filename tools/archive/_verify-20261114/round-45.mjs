// round-45 — 补截图:①服务端 Jasper PDF 渲染图 ②5173 纸面(尽快截,规避页面自动导航)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => (s.name || '').includes('verify-20261114-r11'))
const task = entry && entry.ownership !== 'agent' ? await takeOverTaskSpace(entry.id) : await taskSpace(entry.id || 'verify-20261114-r11')
const pages = await task.pages()
const page = pages[0]

async function shot(p, path) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) {}
  try { await p.screenshot({ path }); console.log('SHOT_OK=' + path); return true } catch (e) { console.log('SHOT_ERR=' + path + ' :: ' + (e && e.message).slice(0, 120)); return false }
}

// ① 服务端报表 PDF 渲染截图(PDF 阅读器)
await page.goto('file:///C:/Users/vigna/ego/verify-20261114/r11-report-server.pdf', { timeout: 40000 })
await page.waitForTimeout(6000)
await shot(page, OUT + '/r11-server-report.png')

// ② 5173 纸面截图:新 Page,快速打开后立刻截
let p2
try { p2 = await task.newPage() } catch (e) { console.log('newPage err ' + e.message); p2 = page }
try {
  await p2.goto('http://localhost:5173/#/panelx/list/QC_FIRST_INSP', { timeout: 60000 })
  await p2.waitForTimeout(7000)
  await p2.evaluate(() => {
    const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
    const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('SJ-2026-11-0010'))
    if (tr) tr.click()
  })
  await p2.waitForTimeout(5000)
  const info = await p2.evaluate(() => ({ gzY: document.querySelectorAll('.sample-row td.gz-y').length, hash: location.hash }))
  console.log('P2_INFO=' + JSON.stringify(info))
  await shot(p2, OUT + '/r11-dom-5173.png')
} catch (e) { console.log('P2_ERR=' + (e && e.message).slice(0, 160)) }
try { if (p2 && p2 !== page) await p2.close() } catch (e) {}
const ls = (await fs.readdir(OUT)).filter((f) => f.startsWith('r11-') || f.startsWith('round-45'))
console.log('FILES=' + JSON.stringify(ls))
console.log('DONE round-45')
