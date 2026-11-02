/**
 * print-to-pdf.mjs —— 打开指定面板/单据 → CDP Page.printToPDF → 存 PDF(2026-11-01 第三轮验证用)
 * 用法: node print-to-pdf.mjs [base] [panelCode] [docNo] [outPdf]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:5173'
const PANEL = process.argv[3] || 'QC_OQC_REPORT'
const DOC = process.argv[4] || 'OQC-2026-11-0003'
const OUT = process.argv[5] || 'oqc-sheet-print.pdf'
const FACTORY = process.env.FACTORY || 'YJ_TEST'
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json()
const token = login?.data?.token
const user = login?.data?.user
if (!token) { console.log('登录失败'); process.exit(1) }

const s = await launch({ port: 9473 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1200, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1800)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: '${FACTORY}', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', 'zh-CN')
    return 'ok'
  })()`)
  await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/' + PANEL + '?docNo=' + DOC)}; location.reload(); return 1 })()`)
  await sleep(10000)
  const st = await s.evaluate(`(() => {
    const txt = (el) => (el?.textContent || '').trim()
    const paper = document.querySelector('.oqc-sheet, .fi-sheet, .qr-sheet, .qc-rec-sheet, .record-sheet')
    return {
      hash: location.hash,
      docChip: txt(document.querySelector('.doc-chip')),
      hasPaper: !!paper,
      paperCls: paper ? paper.className : '',
      sideBtns: [...document.querySelectorAll('.as-side-btn')].map(txt).slice(0, 30),
      paperRows: paper ? paper.querySelectorAll('tbody tr').length : 0,
      bodyH: document.body.scrollHeight,
    }
  })()`)
  console.log('[page]', JSON.stringify(st).slice(0, 1200))
  // 打印样式类(与侧栏「打印」按钮同一口径):准备打印 DOM
  await s.evaluate(`(() => { document.body.classList.add('approval-printing'); return 1 })()`)
  await sleep(800)
  const r = await s.send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    paperWidth: 8.27,
    paperHeight: 11.69,
    marginTop: 0.31, marginBottom: 0.31, marginLeft: 0.31, marginRight: 0.31,
  })
  await s.evaluate(`(() => { document.body.classList.remove('approval-printing'); return 1 })()`)
  const b64 = r?.result?.data
  if (!b64) { console.log('[printToPDF][FAIL]', JSON.stringify(r).slice(0, 300)); process.exit(1) }
  await fs.writeFile(HERE + OUT, Buffer.from(b64, 'base64'))
  console.log('[written]', OUT)
  await s.close?.()
} finally { process.exit(0) }
