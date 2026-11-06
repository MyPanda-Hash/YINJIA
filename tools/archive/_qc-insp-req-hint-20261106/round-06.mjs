const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

const dump = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  const out = {}
  for (const panelCode of ['QC_INSP_REQ', 'QC_INSP_REQ_SERIES']) {
    const r = await window.fetch('/api/px/queryFormDataList', {
      method: 'POST', headers: H,
      body: JSON.stringify({ panelCode, condition: { 物料编号: 'YJ-XH-001' }, pageNo: 1, pageSize: 1 }),
    })
    const j = await r.json()
    const doc = j?.data?.list?.[0] || {}
    const key = String(panelCode).toLowerCase()
    const rows = (doc?.detail && doc.detail[key]) || []
    out[panelCode] = {
      status: r.status,
      totalSize: j?.data?.totalSize,
      count: rows.length,
      list: rows.map((x) => ({ id: x.id, 物料类别: x.物料类别, 物料编号: x.物料编号, 文件编码: x.文件编码, 检验依据: x.检验依据 })),
    }
  }
  return out
})
console.log('=== 两个面板按 YJ-XH-001 取数(含 detail 层)===') 
console.log(JSON.stringify(dump, null, 2))

// 打开弹窗:·检验要求· 那个 span
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-lib-btn')].find((n) => (n.textContent || '').includes('检验要求') && !(n.textContent || '').includes('带入'))
  if (!el) return 'not-found'
  el.click()
  return 'clicked'
})
console.log('click -> ' + clicked)
await page.waitForTimeout(4000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('来料检验要求'))
  if (!d) return { found: false }
  return {
    found: true,
    sub: (d.querySelector('.req-view-sub')?.innerText || '').replace(/\s+/g, ' ').trim(),
    warn: [...d.querySelectorAll('.req-view-warn')].map((n) => n.textContent.trim()),
    head: [...d.querySelectorAll('thead th')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
    firstRow: [...d.querySelectorAll('tbody tr')].slice(0, 1).map((tr) => [...tr.children].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40))),
  }
})
console.log('=== 弹窗 ===')
console.log(JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-req-hint-20261106/round-06.png' })
