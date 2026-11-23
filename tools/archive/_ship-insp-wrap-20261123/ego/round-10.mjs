const task = await taskSpace('shipinsp-wrap-20261123')
const page = task.page('p1')
const out = 'C:/Users/vigna/ego/shipinsp-wrap-20261123/'

async function openPanel(code, docNo, tabName) {
  await page.goto('http://localhost:5173/#/panelx/list/' + code, { timeout: 40000 })
  await page.waitForTimeout(3500)
  if (tabName) {
    await page.evaluate((name) => {
      const els = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').trim() === name)
      if (els.length) els[els.length - 1].click()
    }, tabName)
    await page.waitForTimeout(2000)
  }
  const ok = await page.evaluate((no) => {
    const tr = [...document.querySelectorAll('tr')].find((t) => (t.innerText || '').includes(no))
    if (!tr) return false
    tr.click()
    return true
  }, docNo)
  await page.waitForTimeout(3500)
  return ok
}

async function clipRow(text) {
  const box = await page.evaluate((needle) => {
    const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
    const tr = rows.find((r) => (r.innerText || '').replace(/\s+/g, '').includes(needle))
    if (!tr) return null
    tr.scrollIntoView({ block: 'center' })
    const r = tr.getBoundingClientRect()
    return {
      x: Math.max(0, Math.round(r.x) - 2),
      y: Math.max(0, Math.round(r.y) - 2),
      width: Math.round(Math.min(r.width + 4, window.innerWidth - 4)),
      height: Math.round(Math.min(r.height + 4, window.innerHeight - 4)),
    }
  }, text)
  await page.waitForTimeout(600)
  if (!box) return null
  const box2 = await page.evaluate((needle) => {
    const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
    const tr = rows.find((r) => (r.innerText || '').replace(/\s+/g, '').includes(needle))
    if (!tr) return null
    const r = tr.getBoundingClientRect()
    return {
      x: Math.max(0, Math.round(r.x) - 2),
      y: Math.max(0, Math.round(r.y) - 2),
      width: Math.round(Math.min(r.width + 4, window.innerWidth - 4)),
      height: Math.round(Math.min(r.height + 4, window.innerHeight - 4)),
    }
  }, text)
  return box2
}

// ① 出货检验(功能·可编辑):真实长项目名 "*整体尺寸(外包无纺布)"
const ok1 = await openPanel('QC_PROC_INSP', 'ZC-2026-10-0131', '全部')
const proc = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
  const tr = rows.find((r) => (r.innerText || '').includes('整体尺寸'))
  if (!tr) return { found: false }
  const ta = tr.querySelector('td.c-item textarea')
  const td = tr.querySelector('td.c-item')
  return {
    found: true, text: (tr.innerText || '').replace(/\s+/g, ' ').trim(),
    tdW: Math.round(td.getBoundingClientRect().width), tdH: Math.round(td.getBoundingClientRect().height),
    tag: ta ? 'textarea' : 'other', value: ta ? ta.value : null,
    taH: ta ? Math.round(ta.getBoundingClientRect().height) : null,
    taScrollH: ta ? ta.scrollHeight : null, taClientH: ta ? ta.clientHeight : null,
    overflowX: ta ? ta.scrollWidth > ta.clientWidth : null,
    overflowY: ta ? ta.scrollHeight > ta.clientHeight : null,
  }
})
console.log('PROC(可编辑):', JSON.stringify(proc, null, 1))
console.log('OPEN proc doc:', ok1)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.waitForTimeout(500)
const b1 = await clipRow('整体尺寸')
if (b1) await page.screenshot({ path: out + 'p1-proc-item-wrap.png', clip: b1 })
else await page.screenshot({ path: out + 'p1-proc-sheet.png' })

// ② 出货检验(表观·只读):已审核单里 23 字项目名整段显示
await openPanel('QC_ASM_INSP', 'ZJ-2026-10-0135', '已完成')
const asm = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
  const tr = rows.find((r) => (r.innerText || '').replace(/\s+/g, '').includes('内PP棉'))
  if (!tr) return { found: false, rows: rows.map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 5) }
  const sp = tr.querySelector('td.c-item .qr-cell-text')
  const td = tr.querySelector('td.c-item')
  return {
    found: true, text: (tr.innerText || '').replace(/\s+/g, ' ').trim(),
    tdW: Math.round(td.getBoundingClientRect().width), tdH: Math.round(td.getBoundingClientRect().height),
    tag: sp ? 'span' : 'other',
    spanW: sp ? Math.round(sp.getBoundingClientRect().width) : null,
    spanScrollW: sp ? sp.scrollWidth : null, spanClientW: sp ? sp.clientWidth : null,
    overflow: sp ? sp.scrollWidth > sp.clientWidth + 1 : null,
  }
})
console.log('ASM(只读):', JSON.stringify(asm, null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.waitForTimeout(500)
const b2 = await clipRow('内PP棉')
if (b2) await page.screenshot({ path: out + 'p2-asm-item-wrap.png', clip: b2 })
else await page.screenshot({ path: out + 'p2-asm-sheet.png' })
