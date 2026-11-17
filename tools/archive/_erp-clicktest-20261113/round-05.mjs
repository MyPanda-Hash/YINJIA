// round-05: 其余 6 张「有转ERP按钮」的单据逐一点击转ERP(测试账套 + 金蝶沙箱)。
// 每张:选单 → 点「转ERP」→ 边点边收消息 → 读回 是否已转ERP/ERP单号;失败则换下一个候选(最多 3 个)。
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-clicktest-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const factory = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
if (!String(factory).includes('测试')) throw new Error('不是测试账套:' + factory)
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const call = (p, b, f) => post('/api/px/callButton', { panelCode: p, buttonName: b, formData: f, buttonParam: {} })
const findDoc = async (panel, no) => {
  const r = await post('/api/px/queryFormDataList', { panelCode: panel, condition: {}, keyword: no, pageNo: 1, pageSize: 5 })
  return (r.body?.data?.list || []).find((d) => String(d['编号']) === no) || null
}

/** 在某个面板里:选单 → 点「转ERP」→ 收消息 → 读回推送结果 */
async function clickErp(panel, docNo) {
  await page.goto(`http://localhost:5173/#/panelx/list/${panel}`, { timeout: 40000 })
  await page.waitForTimeout(6000)
  await page.evaluate(() => {
    window.__msgs = []
    if (!window.__msgObserver) {
      window.__msgObserver = new MutationObserver(() => {
        document.querySelectorAll('.el-message__content').forEach((el) => {
          const t = (el.textContent || '').trim()
          if (t && window.__msgs[window.__msgs.length - 1] !== t) window.__msgs.push(t)
        })
      })
      window.__msgObserver.observe(document.body, { childList: true, subtree: true })
    }
  })
  const picked = await page.evaluate((no) => {
    const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
    const hit = rows.find((r) => (r.textContent || '').includes(no))
    if (!hit) return { ok: false, railCount: rows.length }
    hit.click()
    return { ok: true }
  }, docNo)
  if (!picked.ok) return { panel, docNo, ok: false, why: '未在左栏找到该单', picked }
  await page.waitForTimeout(2800)
  const btn = await page.evaluate(() => {
    const t = [...document.querySelectorAll('.tools .tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '转ERP')
    if (!t) return { has: false }
    const main = t.querySelector('.tb-main')
    const disabled = (main?.className || '').includes('disabled')
    main?.click()
    return { has: true, disabled, doc: (document.querySelector('.doc-chip')?.textContent || '').trim() }
  })
  let msgs = []
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1500)
    msgs = await page.evaluate(() => window.__msgs || [])
    if (msgs.length) break
  }
  const doc = await findDoc(panel, docNo)
  return {
    panel, docNo, ok: !!(doc && String(doc['是否已转ERP'] ?? '') === '是'),
    btn, msgs, 是否已转ERP: doc?.['是否已转ERP'], ERP单号: doc?.['ERP单号'],
  }
}

const plan = [
  ['QC_RETURN', 'TH-2026-11-0001'],
  ['FINISH_IN', 'FI-2026-10-0001'],
  ['OTHER_IN', 'OI-2026-11-0002'],
  ['SALE_OUT', 'XSCK-20270901-00001'],
  ['MATERIAL_OUT', 'LL-2026-11-0008'],
]

const out = []
for (const [panel, no] of plan) {
  const r = await clickErp(panel, no)
  out.push(r)
  console.log(panel + ' ' + no + ' → ' + JSON.stringify({ ok: r.ok, msgs: r.msgs, ERP单号: r.ERP单号 }))
  await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-05.json', JSON.stringify(out, null, 2), 'utf8')
}

// 其他出库单:没有"未转"的单 → 弃审+再审核一张,造出"未转"再点
const oo = await post('/api/px/queryFormDataList', { panelCode: 'OTHER_OUT', condition: {}, pageNo: 1, pageSize: 100 })
const ooDoc = (oo.body?.data?.list || []).find((d) => String(d['单据状态']) === '已审核' && String(d['是否已转ERP'] ?? '') === '是')
let ooNo = String(ooDoc?.['编号'] || '')
if (ooNo) {
  const un = await call('OTHER_OUT', '弃审', { 编号: ooNo })
  const aud = await call('OTHER_OUT', '审核', { 编号: ooNo })
  console.log('OTHER_OUT_PREP ' + ooNo + ' 弃审=' + un.status + ' 审核=' + aud.status + ' ' + JSON.stringify(aud.body?.data || aud.body).slice(0, 120))
  const r = await clickErp('OTHER_OUT', ooNo)
  out.push(r)
  console.log('OTHER_OUT ' + ooNo + ' → ' + JSON.stringify({ ok: r.ok, msgs: r.msgs, ERP单号: r.ERP单号 }))
}
await fs.writeFile('C:/Users/Lenovo/ego/erp-clicktest-20261113/round-05.json', JSON.stringify(out, null, 2), 'utf8')
