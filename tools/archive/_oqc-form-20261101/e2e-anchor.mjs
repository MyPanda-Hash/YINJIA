/**
 * e2e-anchor.mjs —— 「生产批次锚」第一步验证(2026-11-01)
 *  ① 销售出库勾选 B-92-25 行生成报告 → 头表应写入 工单号/工单行号(与成品检验单同源)
 *  ② 出厂检验报告左栏「工单号」列显示(历史回填单 0003 也有)
 *  ③ 截图留档
 * 用法: node e2e-anchor.mjs [base]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const token = login?.data?.token
const user = login?.data?.user
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

// ---- ① 生成(B-92-25 行 id=12) ----
const gen = await (await fetch(BASE + '/api/oqc/generate', { method: 'POST', headers: H, body: JSON.stringify({ 出库单号: 'XSCK-2026-11-99001', 明细id: [12] }) })).json()
console.log('[generate]', JSON.stringify(gen?.data))
const no = gen?.data?.['单据编号']?.[0] || ''
if (!no) { console.log('[FAIL] 未生成'); process.exit(1) }

// ---- 头表锚字段回读(getFormDescriptor 取整单) ----
const fd = await (await fetch(BASE + '/api/px/getFormDescriptor?panelCode=QC_OQC_REPORT&code=' + encodeURIComponent(no), { headers: { Authorization: 'Bearer ' + token } })).json()
const d = fd?.data?.data || {}
console.log('[head] 工单号=' + (d['工单号'] ?? '(空)') + ' 工单行号=' + (d['工单行号'] ?? '(空)') + ' 批次号=' + (d['批次号'] ?? '') + ' 成品检验单号=' + (d['成品检验单号'] ?? ''))

// ---- ② UI:左栏「工单号」列 ----
const s = await launch({ port: 9491 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1800)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', 'zh-CN'); return 1
  })()`)
  await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/QC_OQC_REPORT')}; location.reload(); return 1 })()`)
  await sleep(9000)
  const rail = await s.evaluate(`(() => {
    const r = document.querySelector('.doc-select-rail')
    if (!r) return { ok: false }
    const head = [...r.querySelectorAll('thead th')].map(x => (x.textContent || '').trim()).filter(Boolean)
    const rows = [...r.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => (td.textContent || '').trim()).join(' | ')).slice(0, 12)
    return { ok: true, head, rows }
  })()`)
  console.log('[rail]', JSON.stringify(rail, null, 1).slice(0, 1600))
  // 打开刚生成的单截图
  await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + no)}; location.reload(); return 1 })()`)
  await sleep(9000)
  const r = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (r?.result?.data) { await fs.writeFile(HERE + 'oqc-anchor-1.png', Buffer.from(r.result.data, 'base64')); console.log('[shot] oqc-anchor-1.png') }
  await s.close?.()
} finally { process.exit(0) }
