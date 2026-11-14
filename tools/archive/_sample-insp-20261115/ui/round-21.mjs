/* round-21:证据截图——左侧菜单(品质管理→样品检验) + 送样登记表面板 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-20261115/'
const spaces = await listTaskSpaces()
const entry = spaces.find((s) => s.name === 'sample-insp-20261115')
const task = entry.ownership === 'user' ? await claimTaskSpace(entry.id) : await taskSpace(entry.id)
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))
const log = (...a) => console.log(...a)

async function shotEl(selector, file, scale = 1.2, maxH = 6000) {
  const r = await page.evaluate(async ([sel, sc, mh]) => {
    const el = document.querySelector(sel)
    if (!el) return { err: 'no ' + sel }
    const mm = await import('/node_modules/.vite/deps/modern-screenshot.js')
    const rect = el.getBoundingClientRect()
    const w0 = Math.max(el.scrollWidth, el.offsetWidth, Math.round(rect.width))
    const h0 = Math.min(mh, Math.max(el.scrollHeight, el.offsetHeight, Math.round(rect.height), 400))
    const holder = document.createElement('div')
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + w0 + 'px;height:' + h0 + 'px;overflow:hidden;background:#fff;'
    const clone = el.cloneNode(true)
    clone.style.width = w0 + 'px'
    clone.style.maxWidth = 'none'
    clone.style.height = 'auto'
    holder.appendChild(clone)
    document.body.appendChild(holder)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const url = await mm.domToPng(clone, { scale: sc, backgroundColor: '#ffffff', width: w0, height: h0 })
    holder.remove()
    return { url, w: w0, h: h0 }
  }, [selector, scale, maxH])
  if (r.err) { log('SHOT FAIL', r.err); return null }
  await fs.writeFile(OUT + file, Buffer.from(String(r.url).split(',')[1], 'base64'))
  log('shot', file, r.w + 'x' + r.h)
  return r
}

// ① 左侧导航:展开 品质管理,截图
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(4500)
const expanded = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.leftnav .nav-group, .leftnav .nav-item, .leftnav *')]
  const hit = groups.find((e) => (e.textContent || '').trim() === '品质管理')
  if (hit) hit.click()
  return !!hit
})
await page.waitForTimeout(1200)
await shotEl('.leftnav', 'round-21-01-menu-qc.png', 1.2, 4000)
const menuText = await page.evaluate(() => (document.querySelector('.leftnav')?.innerText || '').replace(/\s+/g, ' '))
log('menu has 样品检验:', menuText.includes('样品检验'), '| has 送样登记表:', menuText.includes('送样登记表'), '| has 检验委托单:', menuText.includes('检验委托单'))

// ② 送样登记表面板
await page.evaluate(() => { location.hash = '#/panelx/list/SAMPLE_REG' })
await page.waitForTimeout(3500)
const info = await page.evaluate(() => ({
  hash: location.hash,
  rows: document.querySelectorAll('.el-table__body-wrapper tbody tr').length,
  headers: [...document.querySelectorAll('.el-table__header-wrapper th')].map((th) => (th.innerText || '').trim()).filter(Boolean).slice(0, 12),
  total: (document.querySelector('.el-pagination__total')?.textContent || '').trim(),
  toolbar: [...document.querySelectorAll('.panelx-list .toolbar .el-button, .panelx-list .top-bar button')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 16),
}))
log('SAMPLE_REG:', JSON.stringify(info))
await shotEl('.panelx-list', 'round-21-02-sample-reg-panel.png', 1.0, 5000)
log('DONE')
