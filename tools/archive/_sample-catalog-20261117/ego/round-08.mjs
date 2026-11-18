// round-08:精确定位「检验类别」格的按钮(.ic-cat-cell .ic-pick-btn)→ 目录弹窗 → 勾锂/钠 → 带入 → 纸面取证
const TASK = 'sample-catalog-rev-20261117'
const OUT = 'D:/workspace/yinjia/tools/archive/_sample-catalog-20261117/ego'
const task = await taskSpace(TASK)
const page = task.page('p1')
const log = (m, v) => console.log(m, typeof v === 'string' ? v : JSON.stringify(v))
async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot ->', `${OUT}/${name}.png`)
}

const DOCNO = 'WT-2026-11-9008'
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(3500)
await page.reload()
await page.waitForTimeout(5000)
await page.evaluate((no) => {
  const tr = [...document.querySelectorAll('tbody tr')].find((r) => (r.textContent || '').includes(no))
  if (tr) tr.click()
}, DOCNO)
await page.waitForTimeout(5000)
log('sheetClass', await page.evaluate(() => (document.querySelector('[data-ic-sheet]') || {}).className))

// 关掉可能残留的弹窗
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(600)

log('catBtn', await page.evaluate(() => {
  const b = document.querySelector('.ic-cat-cell .ic-pick-btn')
  if (!b) return null
  b.click()
  return (b.textContent || '').trim()
}))
await page.waitForTimeout(4500)
log('dialogs', await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].map((d) => (d.querySelector('.el-dialog__title') || {}).textContent || (d.textContent || '').slice(0, 30))))

const dlg = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('从送样登记表选择检验项目'))
  if (!box) return null
  return {
    ths: [...box.querySelectorAll('th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
    first: [...box.querySelectorAll('tbody tr')].slice(0, 2).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
    total: ((box.textContent || '').match(/共\s*(\d+)\s*项/) || [])[1] || null,
  }
})
log('dialog', dlg)
await shot('round-08-pick-dialog')

if (dlg) {
  const picked = await page.evaluate(() => {
    const box = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('从送样登记表选择检验项目'))
    const want = ['锂', '钠']
    let n = 0
    ;[...box.querySelectorAll('tbody tr')].forEach((tr) => {
      const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ''))
      if (want.some((w) => tds.includes(w))) { const cb = tr.querySelector('input[type=checkbox]'); if (cb) { cb.click(); n++ } }
    })
    return n
  })
  log('勾选行数', picked)
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.el-dialog button')].find((b) => (b.textContent || '').includes('带入选中项'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(3500)
  log('paper', await page.evaluate(() => {
    const sheet = document.querySelector('[data-ic-sheet="INSP_COMMISSION"]')
    const lbl = (name) => {
      const th = [...sheet.querySelectorAll('th')].find((t) => (t.textContent || '').replace(/\s+/g, '').includes(name))
      return th ? (th.parentElement.querySelector('td') || {}).textContent || '' : ''
    }
    return {
      ths: [...sheet.querySelectorAll('.ic-items th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()),
      items: [...sheet.querySelectorAll('.ic-items tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
      total: ((sheet.querySelector('.ic-items-total') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      cat: (lbl('检验类别') || '').replace(/\s+/g, ' ').trim(),
      basis: (lbl('检验依据') || '').replace(/\s+/g, ' ').trim(),
    }
  }))
  await page.evaluate(() => { const s = document.querySelector('.ic-items-cell'); if (s) s.scrollIntoView({ block: 'center' }) })
  await page.waitForTimeout(700)
  await shot('round-08-paper-items')
}
