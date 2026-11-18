// round-07:打开刚建的草稿 WT-2026-11-9008 → 取「选择检验项目」→ 勾锂+钠 → 带入 → 纸面取证
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
await page.waitForTimeout(4000)
await page.reload()
await page.waitForTimeout(5000)
const clicked = await page.evaluate((no) => {
  const tr = [...document.querySelectorAll('tbody tr')].find((r) => (r.textContent || '').includes(no))
  if (!tr) return false
  tr.click(); return true
}, DOCNO)
log('点开草稿 =', clicked)
await page.waitForTimeout(5000)
log('sheetClass', await page.evaluate(() => (document.querySelector('[data-ic-sheet]') || {}).className))
log('hasPick', await page.evaluate(() => !!document.querySelector('.ic-pick-btn')))
log('buttons', await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 12)))
await shot('round-07-edit')

if (!(await page.evaluate(() => !!document.querySelector('.ic-pick-btn')))) {
  log('bodyHead', await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 500)))
} else {
  await page.evaluate(() => document.querySelector('.ic-pick-btn').click())
  await page.waitForTimeout(4500)
  log('dialog', await page.evaluate(() => {
    const box = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('从送样登记表选择检验项目'))
    if (!box) return null
    return {
      ths: [...box.querySelectorAll('th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
      first: [...box.querySelectorAll('tbody tr')].slice(0, 1).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
      total: ((box.textContent || '').match(/共\s*(\d+)\s*项/) || [])[1] || null,
    }
  }))
  await shot('round-07-pick-dialog')

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
    return {
      ths: [...sheet.querySelectorAll('.ic-items th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()),
      items: [...sheet.querySelectorAll('.ic-items tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
      total: ((sheet.querySelector('.ic-items-total') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      cat: (sheet.innerText.match(/检验类别\s*\n?\s*([^\n]{0,60})/) || [])[1] || '',
      basis: (sheet.innerText.match(/检验依据\s*\n?\s*([^\n]{0,60})/) || [])[1] || '',
    }
  }))
  await page.evaluate(() => { const s = document.querySelector('.ic-items-cell') || document.querySelector('[data-ic-sheet]'); if (s) s.scrollIntoView({ block: 'center' }) })
  await page.waitForTimeout(700)
  await shot('round-07-paper-items')
}
