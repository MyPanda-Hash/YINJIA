// round-04 找工具条「新增」→ 进入编辑态 → 打开「选择检验项目」弹窗 → 勾 2 项带入 → 纸面取证
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

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)

log('toolbar buttons', await page.evaluate(() =>
  [...document.querySelectorAll('button')].map((b) => ({ t: (b.textContent || '').replace(/\s+/g, ' ').trim(), c: b.className }))
    .filter((x) => x.t && x.t.length < 20)))

// 点「新增」(找不到就点「新增流程」)
const clicked = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button')].filter((b) => {
    const t = (b.textContent || '').replace(/\s+/g, ' ').trim()
    return t === '新增' || t === '新增流程' || t.startsWith('新增')
  })
  if (!cands.length) return null
  cands[0].click()
  return (cands[0].textContent || '').trim()
})
log('clicked add =', clicked)
await page.waitForTimeout(5000)
log('sheetClass', await page.evaluate(() => (document.querySelector('[data-ic-sheet]') || {}).className))
log('hasPick', await page.evaluate(() => !!document.querySelector('.ic-pick-btn')))
await shot('round-04-editing')

if (await page.evaluate(() => !!document.querySelector('.ic-pick-btn'))) {
  await page.evaluate(() => document.querySelector('.ic-pick-btn').click())
  await page.waitForTimeout(4000)
  const dlg = await page.evaluate(() => {
    const box = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('从送样登记表选择检验项目'))
    if (!box) return null
    return {
      ths: [...box.querySelectorAll('th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
      first2: [...box.querySelectorAll('tbody tr')].slice(0, 2).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
      count: ((box.textContent || '').match(/共\s*(\d+)\s*项/) || [])[1] || null,
    }
  })
  log('dialog', dlg)
  await shot('round-04-pick-dialog')

  await page.evaluate(() => {
    const box = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('从送样登记表选择检验项目'))
    ;[...box.querySelectorAll('tbody tr')].slice(0, 2).forEach((tr) => {
      const cb = tr.querySelector('input[type=checkbox]'); if (cb) cb.click()
    })
  })
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.el-dialog button')].find((b) => (b.textContent || '').includes('带入选中项'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(3000)
  log('paper', await page.evaluate(() => {
    const sheet = document.querySelector('[data-ic-sheet="INSP_COMMISSION"]')
    return {
      ths: [...sheet.querySelectorAll('.ic-items th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()),
      items: [...sheet.querySelectorAll('.ic-items tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
      total: ((sheet.querySelector('.ic-items-total') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      cat: (sheet.innerText.match(/检验类别\*?\s*([^\n]{0,80})/) || [])[1] || '',
    }
  }))
  await page.evaluate(() => { const s = document.querySelector('[data-ic-sheet]'); if (s) s.scrollIntoView({ block: 'start' }) })
  await page.waitForTimeout(600)
  await shot('round-04-paper-items')
}
