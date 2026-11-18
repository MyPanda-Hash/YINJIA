// round-06:接口建草稿(buttonName=保存)→ 界面打开 → 「选择检验项目」→ 勾锂/钠 → 带入 → 纸面取证
//           → 保存 → 读回校验(标题键=标准方法检出限/金额含税) → 删除草稿(测试库)
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
await page.waitForTimeout(4500)

// 页面内接口助手(复用界面登录态)
await page.evaluate(() => {
  const tok = (() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.token) return v.token } catch (e) {} } return null })()
  window.__h = { 'Content-Type': 'application/json' }
  if (tok) window.__h.Authorization = 'Bearer ' + tok
  window.__call = async (path, body) => {
    const r = await fetch('/api' + path, { method: 'POST', headers: window.__h, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    return { http: r.status, code: j.code, msg: j.message, data: j.data }
  }
})

const created = await page.evaluate(() => window.__call('/px/callButton', {
  panelCode: 'INSP_COMMISSION', buttonName: '保存', formData: {}, buttonParam: {},
}))
log('create draft', { http: created.http, code: created.code, msg: created.msg, no: created.data?.['编号'] || created.data?.formNo })
const docNo = created.data?.['编号'] || created.data?.formNo || null

await page.reload()
await page.waitForTimeout(5000)
if (docNo) {
  await page.evaluate((no) => {
    const tr = [...document.querySelectorAll('tbody tr')].find((r) => (r.textContent || '').includes(no))
    if (tr) tr.click()
  }, docNo)
  await page.waitForTimeout(4500)
}
log('sheetClass', await page.evaluate(() => (document.querySelector('[data-ic-sheet]') || {}).className))
log('hasPick', await page.evaluate(() => !!document.querySelector('.ic-pick-btn')))
await shot('round-06-edit')

if (await page.evaluate(() => !!document.querySelector('.ic-pick-btn'))) {
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
  await shot('round-06-pick-dialog')

  const picked = await page.evaluate(() => {
    const box = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('从送样登记表选择检验项目'))
    const want = ['锂', '钠']
    let n = 0
    ;[...box.querySelectorAll('tbody tr')].forEach((tr) => {
      const first = (tr.querySelector('td')?.textContent || '').replace(/\s+/g, '')
      if (want.includes(first)) { const cb = tr.querySelector('input[type=checkbox]'); if (cb) { cb.click(); n++ } }
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
  const paper = await page.evaluate(() => {
    const sheet = document.querySelector('[data-ic-sheet="INSP_COMMISSION"]')
    return {
      ths: [...sheet.querySelectorAll('.ic-items th')].map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()),
      items: [...sheet.querySelectorAll('.ic-items tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
      total: ((sheet.querySelector('.ic-items-total') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      bodyDiff: null,
    }
  })
  log('paper', paper)
  await page.evaluate(() => { const s = document.querySelector('[data-ic-sheet]'); if (s) s.scrollIntoView({ block: 'start' }) })
  await page.waitForTimeout(700)
  await shot('round-06-paper-items')

  // 保存
  const saveRes = await page.evaluate(() => window.__call('/px/callButton', {
    panelCode: 'INSP_COMMISSION', buttonName: '保存',
    formData: { 编号: window.__docNo || null }, buttonParam: {},
  })).catch((e) => ({ err: String(e) }))
  log('save via api(skip-if-error)', saveRes && (saveRes.code ?? saveRes.err))
}

// 读回:目录行的数据键 + 委托单
const back = await page.evaluate(() => window.__call('/px/queryFormDataList', {
  panelCode: 'SAMPLE_REG', keyword: '锂', condition: {}, pageNo: 1, pageSize: 5,
}))
const rows = back.data?.list?.[0]?.detail?.items || []
log('catalog 锂 readback keys', rows.length ? Object.keys(rows[0]) : [])
log('catalog 锂 readback value', rows[0] ? { 元素: rows[0]['检测元素'], 检出限: rows[0]['标准方法检出限'], 旧键: rows[0]['内部检出限'] ?? '<absent>' } : null)
