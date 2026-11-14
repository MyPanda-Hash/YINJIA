// round-07: 入库类两张(产品入库/其他入库)用更长等待重试;材料出库改挑"行上有存货编码"的单。
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-clicktest-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const findDoc = async (panel, no) => {
  const r = await post('/api/px/queryFormDataList', { panelCode: panel, condition: {}, keyword: no, pageNo: 1, pageSize: 5 })
  return (r.body?.data?.list || []).find((d) => String(d['编号']) === no) || null
}
const detailRows = async (panel, no) => {
  const res = await post('/api/px/queryFormDataList', { panelCode: panel, condition: {}, keyword: no, pageNo: 1, pageSize: 20 })
  for (const d of res.body?.data?.list || []) {
    const det = d?.detail && typeof d.detail === 'object' ? d.detail : {}
    for (const v of Object.values(det)) {
      if (!Array.isArray(v) || !v.length) continue
      const hit = v.filter((it) => String(it['单据编号'] || d['编号'] || '') === no)
      if (hit.length) return hit
      if (String(d['编号'] || '') === no) return v
    }
  }
  return []
}
async function clickErp(panel, docNo, waitRounds = 40) {
  await page.goto(`http://localhost:5173/#/panelx/list/${panel}`, { timeout: 40000 })
  await page.waitForTimeout(6000)
  await page.evaluate(() => {
    window.__msgs = []
    window.__dialogs = []
    if (!window.__msgObserver) {
      window.__msgObserver = new MutationObserver(() => {
        document.querySelectorAll('.el-message__content').forEach((el) => {
          const t = (el.textContent || '').trim()
          if (t && window.__msgs[window.__msgs.length - 1] !== t) window.__msgs.push(t)
        })
        document.querySelectorAll('.el-message-box').forEach((b) => {
          const t = (b.textContent || '').replace(/\s+/g, ' ').trim()
          if (t && !window.__dialogs.includes(t)) window.__dialogs.push(t)
        })
      })
      window.__msgObserver.observe(document.body, { childList: true, subtree: true })
    }
  })
  const picked = await page.evaluate((no) => {
    const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
    const hit = rows.find((r) => (r.textContent || '').includes(no))
    if (!hit) return false
    hit.click()
    return true
  }, docNo)
  if (!picked) return { panel, docNo, ok: false, why: '左栏没找到' }
  await page.waitForTimeout(2800)
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('.tools .tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '转ERP')
    t?.querySelector('.tb-main')?.click()
  })
  let msgs = []
  for (let i = 0; i < waitRounds; i++) {
    await page.waitForTimeout(1500)
    msgs = await page.evaluate(() => window.__msgs || [])
    if (msgs.length) break
  }
  const doc = await findDoc(panel, docNo)
  return {
    panel, docNo, ok: !!(doc && String(doc['是否已转ERP'] ?? '') === '是'),
    msgs, dialogs: await page.evaluate(() => window.__dialogs || []),
    是否已转ERP: doc?.['是否已转ERP'], ERP单号: doc?.['ERP单号'],
  }
}

const out = []
for (const [panel, no] of [['FINISH_IN', 'FI-2026-10-0001'], ['OTHER_IN', 'OI-2026-11-0002']]) {
  const r = await clickErp(panel, no)
  out.push(r)
  console.log(panel + ' ' + no + ' → ' + JSON.stringify({ ok: r.ok, msgs: r.msgs, ERP单号: r.ERP单号 }))
  await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-07.json', JSON.stringify(out, null, 2), 'utf8')
}

// 材料出库:挑第一行有存货编码的未转单
const mo = await post('/api/px/queryFormDataList', { panelCode: 'MATERIAL_OUT', condition: {}, pageNo: 1, pageSize: 60 })
const cands = (mo.body?.data?.list || []).filter((d) => String(d['单据状态']) === '已审核' && String(d['是否已转ERP'] ?? '') !== '是').slice(0, 6)
for (const c of cands) {
  const no = String(c['编号'])
  const rows = await detailRows('MATERIAL_OUT', no)
  const okRow = rows.find((it) => String(it['存货编码'] || '').trim() !== '')
  console.log('MO_CAND ' + no + ' 行=' + rows.length + ' 有存货编码=' + !!okRow + ' 仓库=' + (okRow?.['仓库'] || ''))
  if (!okRow) continue
  const r = await clickErp('MATERIAL_OUT', no)
  out.push(r)
  console.log('MATERIAL_OUT ' + no + ' → ' + JSON.stringify({ ok: r.ok, msgs: r.msgs, ERP单号: r.ERP单号 }))
  await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-07.json', JSON.stringify(out, null, 2), 'utf8')
  if (r.ok) break
}
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-07.json', JSON.stringify(out, null, 2), 'utf8')
