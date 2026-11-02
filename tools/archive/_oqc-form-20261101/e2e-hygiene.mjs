/**
 * e2e-hygiene.mjs —— 出厂检验报告「卫生安全 15 项结果可填写」端到端(2026-11-01 第四轮)
 *  ① 打开纸面(测试账套 OQC-2026-11-0003)→ 卫生安全 15 行结果列填值 → 保存 → 刷新回读
 *  ② 打印(DOM 打印口径:body.approval-printing + Page.printToPDF)→ PDF
 *  ③ 导出报表(服务端 Jaser)→ PDF(核对第 2 页卫生安全表印的是填写值)
 *  ④ 清空还原(演示单保持空白,交给用户自己填)
 *
 * 用法: node e2e-hygiene.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const DOC = process.argv[3] || 'OQC-2026-11-0003'
const FACTORY = 'YJ_TEST'
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const VALUES = ['0.12', '无', '无', '1.79', '20', '0.46', 'ND', 'ND', 'ND', 'ND', 'ND', 'ND', 'ND', 'ND', 'ND']

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json()
const token = login?.data?.token
const user = login?.data?.user
if (!token) { console.log('登录失败'); process.exit(1) }

const shot = async (s, name) => {
  const r = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (!r?.result?.data) return console.log('[shot][FAIL]', name)
  await fs.writeFile(HERE + name, Buffer.from(r.result.data, 'base64'))
  console.log('[shot]', name)
}
const openDoc = async (s) => {
  await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + DOC)}; location.reload(); return 1 })()`)
  await sleep(9000)
}

const s = await launch({ port: 9483 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1800)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: '${FACTORY}', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', 'zh-CN'); return 1
  })()`)
  await openDoc(s)

  // ---- ① 填 15 个结果 ----
  const filled = await s.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.oqc-hygiene-input input')]
    if (inputs.length !== 15) return 'inputs=' + inputs.length
    const vals = ${JSON.stringify(VALUES)}
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    inputs.forEach((inp, i) => { setter.call(inp, vals[i]); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })) })
    return 'filled=' + inputs.map(x => x.value).join('|')
  })()`)
  console.log('[fill]', filled)
  await sleep(500)
  const saved = await s.evaluate(`(() => {
    const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '保存')
    if (!b) return 'no-save'; b.click(); return 'save-clicked'
  })()`)
  console.log('[save]', saved)
  await sleep(1200)
  console.log('[msg]', JSON.stringify(await s.evaluate(`[...document.querySelectorAll('.el-message')].map(x => (x.textContent || '').trim())`)))
  await sleep(3500)
  await shot(s, 'e2e-hygiene-1-filled.png')

  // 刷新回读
  await openDoc(s)
  const back = await s.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.oqc-hygiene-input input')]
    return { n: inputs.length, vals: inputs.map(x => x.value) }
  })()`)
  console.log('[reload] n=' + back.n + ' vals=' + back.vals.join('|'))

  // ---- ② 打印 PDF(DOM 打印) ----
  await s.evaluate(`(() => { document.body.classList.add('approval-printing'); return 1 })()`)
  await sleep(600)
  const domPdf = await s.send('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true,
    paperWidth: 8.27, paperHeight: 11.69,
    marginTop: 0.31, marginBottom: 0.31, marginLeft: 0.31, marginRight: 0.31,
  })
  await s.evaluate(`(() => { document.body.classList.remove('approval-printing'); return 1 })()`)
  if (domPdf?.result?.data) {
    await fs.writeFile(HERE + 'e2e-hygiene-print.pdf', Buffer.from(domPdf.result.data, 'base64'))
    console.log('[print] e2e-hygiene-print.pdf')
  }

  // ---- ③ 服务端报表 PDF ----
  const r = await fetch(`${BASE}/api/report/export?code=qc_oqc&panelCode=QC_OQC_REPORT&docNo=${encodeURIComponent(DOC)}&format=pdf`, { headers: { Authorization: 'Bearer ' + token } })
  if (r.ok && (r.headers.get('content-type') || '').includes('pdf')) {
    await fs.writeFile(HERE + 'e2e-hygiene-report.pdf', Buffer.from(await r.arrayBuffer()))
    console.log('[report] e2e-hygiene-report.pdf')
  } else console.log('[report][FAIL]', r.status, (await r.text()).slice(0, 300))

  // ---- ④ 清空还原 ----
  await s.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.oqc-hygiene-input input')]
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    inputs.forEach((inp) => { setter.call(inp, ''); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })) })
    return 1
  })()`)
  await sleep(500)
  await s.evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '保存'); if (b) b.click(); return 1 })()`)
  await sleep(3500)
  const cleared = await s.evaluate(`(() => [...document.querySelectorAll('.oqc-hygiene-input input')].map(x => x.value).join('|'))()`)
  console.log('[cleared]', JSON.stringify(cleared))

  await s.close?.()
} finally { process.exit(0) }
