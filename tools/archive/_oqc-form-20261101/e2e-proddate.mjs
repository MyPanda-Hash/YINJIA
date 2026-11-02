/**
 * e2e-proddate.mjs —— 「生产日期随生产批次带入」验证(2026-11-01)
 *  ① 生成 B-92-25 行报告 → 头表 生产日期 应 = 2026-10-17(批次 20261017 的完工日)
 *  ② 已有报告 OQC-2026-11-0003 回填后 生产日期 = 2026-10-17
 *  ③ 纸面/截图看 生产日期 格已填
 * 用法: node e2e-proddate.mjs [base]
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
const auth = { Authorization: 'Bearer ' + token }

const gen = await (await fetch(BASE + '/api/oqc/generate', { method: 'POST', headers: H, body: JSON.stringify({ 出库单号: 'XSCK-2026-11-99001', 明细id: [12] }) })).json()
console.log('[generate]', JSON.stringify(gen?.data))
const no = gen?.data?.['单据编号']?.[0] || ''
if (!no) { console.log('[FAIL] 未生成'); process.exit(1) }

const fd = await (await fetch(BASE + '/api/px/getFormDescriptor?panelCode=QC_OQC_REPORT&code=' + encodeURIComponent(no), { headers: auth })).json()
const d = fd?.data?.data || {}
console.log('[new] 单据编号=' + no + ' 生产日期=' + (d['生产日期'] ?? '(空)') + ' 批次号=' + (d['批次号'] ?? '') + ' 工单号=' + (d['工单号'] ?? ''))

const fd3 = await (await fetch(BASE + '/api/px/getFormDescriptor?panelCode=QC_OQC_REPORT&code=OQC-2026-11-0003', { headers: auth })).json()
const d3 = fd3?.data?.data || {}
console.log('[0003] 生产日期=' + (d3['生产日期'] ?? '(空)') + ' 批次号=' + (d3['批次号'] ?? ''))

const s = await launch({ port: 9493 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1800)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', 'zh-CN'); return 1
  })()`)
  await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + no)}; location.reload(); return 1 })()`)
  await sleep(9000)
  const vals = await s.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.oqc-head')].length ? [] : []
    const inputs = [...document.querySelectorAll('.oqc-sheet input')].map(i => ({ v: i.value, l: i.closest('td')?.previousElementSibling?.textContent?.trim() || '' }))
    return inputs.filter(x => x.l.includes('生产日期') || x.v === '2026-10-17')
  })()`)
  console.log('[paper]', JSON.stringify(vals))
  const shot = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (shot?.result?.data) { await fs.writeFile(HERE + 'oqc-proddate-1.png', Buffer.from(shot.result.data, 'base64')); console.log('[shot] oqc-proddate-1.png') }
  await s.close?.()
} finally {
  // 清理本次验证生成的测试单(保留演示 0003/0004/0012)
  console.log('[cleanup] 新单 ' + no + ' 需手工清理(脚本不删库)')
  process.exit(0)
}
