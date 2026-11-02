/**
 * e2e-final.mjs —— 出厂检验报告纸张式面板 收尾取证(2026-11-01 第三轮)
 *  ① 干净单 OQC-2026-11-0003:整纸截图 + 打印 PDF(2 页)
 *  ② 切 en:纸面英文截图
 *  ③ 已审核只读态:审核 OQC-2026-11-0004 → 纸面变只读(无输入框/无保存) → 截图 → 弃审复原
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const FACTORY = 'YJ_TEST'
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json()
const token = login?.data?.token
const user = login?.data?.user

const shot = async (s, name, full = false) => {
  const r = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full })
  if (!r?.result?.data) return console.log('[shot][FAIL]', name)
  await fs.writeFile(HERE + name, Buffer.from(r.result.data, 'base64'))
  console.log('[shot]', name)
}
const openDoc = async (s, code) => {
  await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + code)}; location.reload(); return 1 })()`)
  await sleep(9000)
}
const clickSide = async (s, text) => s.evaluate(`(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === ${JSON.stringify(text)})
  if (!b) return 'no-btn:' + [...document.querySelectorAll('.as-side-btn')].map(x => (x.textContent || '').trim()).join('/')
  b.click(); return 'clicked'
})()`)

const s = await launch({ port: 9481 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1800)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: '${FACTORY}', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', 'zh-CN'); return 1
  })()`)

  // ① 干净单截图 + 打印
  await openDoc(s, 'OQC-2026-11-0003')
  await shot(s, 'oqc-sheet-final-screen.png')
  await s.evaluate(`(() => { document.body.classList.add('approval-printing'); return 1 })()`)
  await sleep(700)
  const pdf = await s.send('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true,
    paperWidth: 8.27, paperHeight: 11.69,
    marginTop: 0.31, marginBottom: 0.31, marginLeft: 0.31, marginRight: 0.31,
  })
  await s.evaluate(`(() => { document.body.classList.remove('approval-printing'); return 1 })()`)
  if (pdf?.result?.data) {
    await fs.writeFile(HERE + 'oqc-sheet-final-print.pdf', Buffer.from(pdf.result.data, 'base64'))
    console.log('[print] oqc-sheet-final-print.pdf')
  }

  // ② en 纸面
  await s.evaluate(`(() => { localStorage.setItem('mes_locale', 'en'); return 1 })()`)
  await openDoc(s, 'OQC-2026-11-0003')
  const enState = await s.evaluate(`(() => ({
    title: (document.querySelector('.oqc-sheet .oqc-title') || {}).innerText || '',
    headLabels: [...document.querySelectorAll('.oqc-head th')].map(x => (x.textContent || '').trim()),
    gridHeads: [...document.querySelectorAll('.oqc-grid thead th')].map(x => (x.textContent || '').trim()),
  }))()`)
  console.log('[en]', JSON.stringify(enState).slice(0, 500))
  await shot(s, 'oqc-sheet-final-en-screen.png')
  await s.evaluate(`(() => { localStorage.setItem('mes_locale', 'zh-CN'); return 1 })()`)

  // ③ 审核 → 只读态
  await openDoc(s, 'OQC-2026-11-0004')
  const before = await s.evaluate(`(() => ({
    status: (document.querySelector('.doc-status') || {}).innerText || '',
    inputs: document.querySelectorAll('.oqc-sheet input, .oqc-sheet textarea').length,
    sideBtns: [...document.querySelectorAll('.as-side-btn')].map(x => (x.textContent || '').trim()),
  }))()`)
  console.log('[before-audit]', JSON.stringify(before).slice(0, 600))
  const auditClick = await clickSide(s, '审核')
  console.log('[audit-click]', auditClick)
  await sleep(1200)
  const confirmed = await s.evaluate(`(() => {
    const box = document.querySelector('.el-message-box')
    if (!box) return 'no-message-box'
    const btns = [...box.querySelectorAll('button')]
    const ok = btns.find(b => (b.textContent || '').includes('确认审核')) || btns.find(b => (b.className || '').includes('el-button--primary'))
    if (!ok) return 'no-ok:' + btns.map(b => (b.textContent || '').trim()).join('/')
    ok.click(); return 'confirmed:' + (ok.textContent || '').trim()
  })()`)
  console.log('[audit-confirm]', confirmed)
  await sleep(5000)
  const after = await s.evaluate(`(() => ({
    status: (document.querySelector('.doc-status') || {}).innerText || '',
    inputs: document.querySelectorAll('.oqc-sheet input, .oqc-sheet textarea').length,
    sideBtns: [...document.querySelectorAll('.as-side-btn')].map(x => (x.textContent || '').trim()),
    paperText: (document.querySelector('.oqc-sheet')?.innerText || '').slice(0, 200),
  }))()`)
  console.log('[after-audit]', JSON.stringify(after).slice(0, 800))
  await shot(s, 'oqc-sheet-final-audited.png')

  // 复原:弃审
  const undo = await clickSide(s, '弃审')
  console.log('[unaudit-click]', undo)
  await sleep(1200)
  const undoOk = await s.evaluate(`(() => {
    const box = document.querySelector('.el-message-box')
    if (!box) return 'no-box'
    const ok = [...box.querySelectorAll('button')].find(b => (b.className || '').includes('el-button--primary'))
    if (!ok) return 'no-ok'
    ok.click(); return 'clicked'
  })()`)
  console.log('[unaudit-confirm]', undoOk)
  await sleep(3000)
  console.log('[final-status]', await s.evaluate(`(document.querySelector('.doc-status') || {}).innerText || ''`))

  await s.close?.()
} finally { process.exit(0) }
