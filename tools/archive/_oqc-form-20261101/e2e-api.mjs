/**
 * e2e-api.mjs —— 出厂检验报告 API 级端到端(2026-11-01)
 * ① 登录(可切账套 factory=YJ / YJ_TEST) ② /api/oqc/preview ③ /api/oqc/generate
 * ④ /api/report/templates?panelCode=QC_OQC_REPORT ⑤ /api/report/export → PDF 落盘
 *
 * 用法: node e2e-api.mjs [base] [factory] [出库单号] [mode]
 *   mode=preview | generate | export | all
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const FACTORY = process.argv[3] || 'YJ_TEST'
const OUT_NO = process.argv[4] || 'XSCK-2026-11-99001'
const MODE = process.argv[5] || 'all'
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json()
const token = login?.data?.token
if (!token) { console.log('登录失败', JSON.stringify(login).slice(0, 300)); process.exit(1) }
console.log('[login] factory=' + FACTORY + ' user=' + login?.data?.user?.realName)
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const post = async (url, body) => (await fetch(BASE + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()
const get = async (url) => (await fetch(BASE + url, { headers: H })).json()

let docNos = []
if (MODE === 'preview' || MODE === 'all') {
  const pv = await post('/api/oqc/preview', { 出库单号: OUT_NO })
  console.log('[preview]', JSON.stringify(pv?.data, null, 1)?.slice(0, 1600))
}
if (MODE === 'generate' || MODE === 'all') {
  const gen = await post('/api/oqc/generate', { 出库单号: OUT_NO })
  console.log('[generate]', JSON.stringify(gen?.data)?.slice(0, 800))
  docNos = gen?.data?.['单据编号'] || []
}
if (!docNos.length) {
  // export 模式下从库/文件补:允许命令行给单号
  const extra = process.argv[6]
  if (extra) docNos = [extra]
}
if (MODE === 'export' || MODE === 'all') {
  if (!docNos.length) { console.log('没有报告单号可导出(先 generate 或用第 6 参传单号)'); process.exit(1) }
  const tpls = await get('/api/report/templates?panelCode=QC_OQC_REPORT')
  console.log('[templates]', JSON.stringify(tpls?.data)?.slice(0, 600))
  const code = (tpls?.data || []).find(t => t.panelCode === 'QC_OQC_REPORT')?.code || 'generic'
  for (const no of docNos) {
    const url = `${BASE}/api/report/export?code=${encodeURIComponent(code)}&panelCode=QC_OQC_REPORT&docNo=${encodeURIComponent(no)}&format=pdf`
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
    const ct = r.headers.get('content-type') || ''
    if (!r.ok || ct.includes('json')) {
      console.log('[export][FAIL]', no, r.status, (await r.text()).slice(0, 400))
      continue
    }
    const buf = Buffer.from(await r.arrayBuffer())
    const f = path.join(HERE, `e2e-${no}.pdf`)
    await fs.writeFile(f, buf)
    console.log('[export][OK]', no, '模板=' + code, buf.length + ' bytes ->', f)
  }
}
