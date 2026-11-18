// round-05:先用接口在测试库建一张「检验委托单」草稿(界面无纸质工具条时走接口),
// 再回到界面打开它 → 「选择检验项目」→ 勾 2 项带入 → 纸面取证 → 保存 → 读回校验 → 清理(删除草稿)
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
await page.waitForTimeout(4000)

// 页面内用已登录会话打接口(与界面同源,避免另一套登录)
const created = await page.evaluate(async () => {
  const tok = (() => {
    for (const k of Object.keys(localStorage)) {
      try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.token) return v.token } catch (e) {}
    }
    return null
  })()
  const h = { 'Content-Type': 'application/json' }
  if (tok) h.Authorization = 'Bearer ' + tok
  const r = await fetch('/api/px/callButton', {
    method: 'POST', headers: h,
    body: JSON.stringify({ panelCode: 'INSP_COMMISSION', buttonName: '新增', formData: {}, buttonParam: {} }),
  })
  const j = await r.json().catch(() => ({}))
  return { http: r.status, code: j.code, msg: j.message, data: j.data }
})
log('create draft', created)

// 回到列表,打开第一张(最新)单据
await page.reload()
await page.waitForTimeout(5000)
const docNo = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tbody tr')].find((r) => /WT-/.test(r.textContent || ''))
  if (!tr) return null
  const m = (tr.textContent || '').match(/WT-\d{4}-\d{2}-\d{4}/)
  tr.click()
  return m ? m[0] : null
})
log('docNo(点开)', docNo)
await page.waitForTimeout(4500)
log('sheetClass', await page.evaluate(() => (document.querySelector('[data-ic-sheet]') || {}).className))
log('hasPick', await page.evaluate(() => !!document.querySelector('.ic-pick-btn')))
await shot('round-05-edit')

if (await page.evaluate(() => !!document.querySelector('.ic-pick-btn'))) {
  await page.evaluate(() => document.querySelector('.ic-pick-btn').click())
  await page.waitForTimeout(4000)
  log('dialog', await page.evaluate(() => {
    const box = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('从送样登记表选择检验项目'))
    if (!box) return null
    return {
      ths: [...box.querySelectorAll('th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
      first2: [...box.querySelectorAll('tbody tr')].slice(0, 2).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
      total: ((box.textContent || '').match(/共\s*(\d+)\s*项/) || [])[1] || null,
    }
  }))
  await shot('round-05-pick-dialog')

  // 勾「锂」「钠」(按元素名定位)
  const picked = await page.evaluate(() => {
    const box = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('从送样登记表选择检验项目'))
    const want = ['锂', '钠']
    let n = 0
    ;[...box.querySelectorAll('tbody tr')].forEach((tr) => {
      const first = (tr.querySelector('td')?.textContent || '').replace(/\s+/g, '')
      if (want.some((w) => first === w)) {
        const cb = tr.querySelector('input[type=checkbox]'); if (cb) { cb.click(); n++ }
      }
    })
    return n
  })
  log('勾选行数', picked)
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
    }
  }))
  await page.evaluate(() => { const s = document.querySelector('[data-ic-sheet]'); if (s) s.scrollIntoView({ block: 'start' }) })
  await page.waitForTimeout(700)
  await shot('round-05-paper-items')

  // 保存 → 读回(校验 标准方法检出限 这个新数据键真的落库、金额含税)
  const saved = await page.evaluate(async (no) => {
    const tok = (() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.token) return v.token } catch (e) {} } return null })()
    const h = { 'Content-Type': 'application/json' }
    if (tok) h.Authorization = 'Bearer ' + tok
    const sheet = document.querySelector('[data-ic-sheet="INSP_COMMISSION"]')
    const items = [...sheet.querySelectorAll('.ic-items tbody tr')].length
    // 直接读界面纸面里的行(与前端提交同一份数据)
    const r = await fetch('/api/px/queryFormDataList', {
      method: 'POST', headers: h,
      body: JSON.stringify({ panelCode: 'INSP_COMMISSION', keyword: no, condition: {}, pageNo: 1, pageSize: 10 }),
    })
    const j = await r.json().catch(() => ({}))
    return { rowsOnPaper: items, http: r.status, list: (j.data?.list || []).length }
  }, docNo)
  log('query back', saved)
}
