const task = await taskSpace('shipinsp-wrap-20261123')
const page = task.page('p1')
const out = 'C:/Users/vigna/ego/shipinsp-wrap-20261123/'

async function openDoc(code, docNo) {
  await page.goto(`http://localhost:5173/#/panelx/list/${code}?docNo=${docNo}`, { timeout: 40000 })
  await page.waitForTimeout(5000)
  for (let i = 0; i < 3; i++) {
    const state = await page.evaluate(() => ({
      items: document.querySelectorAll('.qr-grid tbody td.c-item').length,
      itemVals: [...document.querySelectorAll('.qr-grid tbody td.c-item textarea, .qr-grid tbody td.c-item input')].map((t) => t.value).filter(Boolean).slice(0, 5),
      spans: [...document.querySelectorAll('.qr-grid tbody td.c-item .qr-cell-text')].map((s) => (s.textContent || '').trim()).filter(Boolean).slice(0, 5),
    }))
    if (state.items > 0 && (state.itemVals.length || state.spans.length)) return state
    console.log('retry', i, JSON.stringify(state))
    const clicked = await page.evaluate((no) => {
      const tr = [...document.querySelectorAll('tr')].find((t) => (t.innerText || '').includes(no))
      if (!tr) return 'not-found'
      tr.click()
      return 'clicked'
    }, docNo)
    console.log('click:', clicked)
    await page.waitForTimeout(3500)
  }
  return null
}

async function shotRow(filename, needle) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) {}
  await page.waitForTimeout(500)
  const box = await page.evaluate((n) => {
    const cells = [...document.querySelectorAll('.qr-grid tbody td.c-item')]
    const td = cells.find((c) => {
      const ta = c.querySelector('textarea, input')
      const sp = c.querySelector('.qr-cell-text')
      const v = ta ? ta.value : sp ? (sp.textContent || '').trim() : ''
      return v.includes(n)
    })
    if (!td) return null
    const tr = td.closest('tr')
    tr.scrollIntoView({ block: 'center' })
    return null
  }, needle)
  await page.waitForTimeout(700)
  const b = await page.evaluate((n) => {
    const cells = [...document.querySelectorAll('.qr-grid tbody td.c-item')]
    const td = cells.find((c) => {
      const ta = c.querySelector('textarea, input')
      const sp = c.querySelector('.qr-cell-text')
      const v = ta ? ta.value : sp ? (sp.textContent || '').trim() : ''
      return v.includes(n)
    })
    if (!td) return null
    const tr = td.closest('tr')
    const r = tr.getBoundingClientRect()
    return { x: Math.max(0, Math.round(r.x) - 2), y: Math.max(0, Math.round(r.y) - 2), width: Math.round(Math.min(r.width + 4, window.innerWidth - 4)), height: Math.round(Math.min(r.height + 4, window.innerHeight - 4)) }
  }, needle)
  if (b) await page.screenshot({ path: out + filename, clip: b })
  else await page.screenshot({ path: out + filename.replace('.png', '-full.png') })
  return b
}

// ① 出货检验(功能·可编辑)
console.log('== PROC ==', JSON.stringify(await openDoc('QC_PROC_INSP', 'ZC-2026-10-0131')))
const proc = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.qr-grid tbody td.c-item')]
  const td = cells.find((c) => {
    const ta = c.querySelector('textarea')
    return ta && ta.value.includes('整体尺寸')
  })
  if (!td) return { found: false }
  const ta = td.querySelector('textarea')
  return {
    found: true, value: ta.value,
    tdW: Math.round(td.getBoundingClientRect().width), tdH: Math.round(td.getBoundingClientRect().height),
    tag: 'textarea', taH: Math.round(ta.getBoundingClientRect().height),
    taScrollH: ta.scrollHeight, taClientH: ta.clientHeight,
    overflowX: ta.scrollWidth > ta.clientWidth, overflowY: ta.scrollHeight > ta.clientHeight,
    align: getComputedStyle(ta).textAlign,
  }
})
console.log('PROC:', JSON.stringify(proc, null, 1))
console.log('shot:', JSON.stringify(await shotRow('p1-proc-item-wrap.png', '整体尺寸')))

// ② 出货检验(表观)已审核:23 字项目名(只读态整段显示)
console.log('== ASM ==', JSON.stringify(await openDoc('QC_ASM_INSP', 'ZJ-2026-10-0135')))
const asm = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.qr-grid tbody td.c-item')]
  const td = cells.find((c) => (c.textContent || '').replace(/\s+/g, '').includes('内PP棉'))
  if (!td) return { found: false, all: cells.map((c) => (c.innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 8) }
  const sp = td.querySelector('.qr-cell-text')
  return {
    found: true, text: (td.innerText || '').replace(/\s+/g, ' ').trim(),
    tdW: Math.round(td.getBoundingClientRect().width), tdH: Math.round(td.getBoundingClientRect().height),
    spanScrollW: sp ? sp.scrollWidth : null, spanClientW: sp ? sp.clientWidth : null,
    overflow: sp ? sp.scrollWidth > sp.clientWidth + 1 : null,
  }
})
console.log('ASM:', JSON.stringify(asm, null, 1))
console.log('shot:', JSON.stringify(await shotRow('p2-asm-item-wrap.png', '内PP棉')))
