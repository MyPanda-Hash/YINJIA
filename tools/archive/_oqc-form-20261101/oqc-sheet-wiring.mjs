/**
 * oqc-sheet-wiring.mjs —— 出厂检验报告纸面版:交互接线验证(2026-11-01 第三轮)
 *   ① 侧栏「打印」→ printApprovalSheet:加 body.approval-printing + 调 window.print()
 *   ② 侧栏「导出」→ 导出弹窗 →「导出 PDF」:请求 /report/export?code=qc_oqc&format=pdf(不是截图)
 *   ③ 侧栏「导出」→ 导出弹窗 →「导出 Excel」:请求 /report/export?...&format=xlsx
 *   ④ 侧栏「导出报表」弹窗 → 打印预览:打开服务端 PDF(window.open 收到 blob: URL)
 *
 * 用法: node oqc-sheet-wiring.mjs [base] [docNo]
 */
import { createRequire } from 'node:module'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:5173'
const DOC = process.argv[3] || 'OQC-2026-11-0003'
const FACTORY = 'YJ_TEST'

const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json()
const token = login?.data?.token
const user = login?.data?.user

const s = await launch({ port: 9478 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1600)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: '${FACTORY}', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', 'zh-CN')
    location.href = ${JSON.stringify(BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + encodeURIComponent(DOC))}; location.reload(); return 1 })()`)
  await sleep(10000)

  // 埋点:XHR 请求、createObjectURL、window.open、window.print
  await s.evaluate(`(() => {
    window.__xhrs = []
    const open = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (m, u, ...rest) { window.__xhrs.push(String(u)); return open.call(this, m, u, ...rest) }
    window.__urls = []
    const cou = URL.createObjectURL
    URL.createObjectURL = function (b) { const u = cou.call(URL, b); window.__urls.push({ url: u, size: b?.size, type: b?.type }); return u }
    window.__opened = []
    window.open = (u, n) => { window.__opened.push(String(u || '')); return { focus() {}, close() {}, location: { href: '' } } }
    window.__printed = 0
    window.print = () => { window.__printed++; return 0 }
    return 'hooked'
  })()`)

  const clickSide = (label) => s.evaluate(`(() => {
    const els = [...document.querySelectorAll('.as-side-btn')].filter(x => (x.textContent || '').trim() === ${JSON.stringify(label)})
    if (!els.length) return 'not-found:' + ${JSON.stringify(label)}
    els[els.length - 1].click()
    return 'clicked:' + els.length
  })()`)

  // ① 打印
  await clickSide('打印')
  await sleep(1200)
  const p1 = await s.evaluate(`({ printed: window.__printed, printing: document.body.classList.contains('approval-printing'), zoom: getComputedStyle(document.documentElement).getPropertyValue('--print-zoom').trim() })`)
  console.log('[① 打印]', JSON.stringify(p1))
  await sleep(1200) // 让 afterprint 兜底/超时收尾
  await s.evaluate(`(() => { document.body.classList.remove('approval-printing'); document.documentElement.style.removeProperty('--print-zoom'); return 1 })()`)

  // ② 导出 → PDF
  console.log('[open 导出]', await clickSide('导出'))
  await sleep(800)
  const dlg1 = await s.evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => x.offsetParent !== null)
    return d ? { title: (d.querySelector('.el-dialog__title') || {}).textContent, items: [...d.querySelectorAll('.efmt-name')].map(x => x.textContent.trim()), descs: [...d.querySelectorAll('.efmt-desc')].map(x => x.textContent.trim()) } : null
  })()`)
  console.log('[导出弹窗]', JSON.stringify(dlg1))
  await s.evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => x.offsetParent !== null)
    const it = [...d.querySelectorAll('.efmt-item')].find(x => (x.textContent || '').includes('导出 PDF'))
    it?.click(); return 1
  })()`)
  await sleep(3500)
  const r2 = await s.evaluate(`({
    xhrs: window.__xhrs.filter(u => u.includes('/report/export')),
    urls: window.__urls.slice(-3),
    msgs: [...document.querySelectorAll('.el-message')].map(x => (x.textContent || '').trim()),
  })`)
  console.log('[② 导出 PDF]', JSON.stringify(r2))

  // ③ 导出 → Excel
  await clickSide('导出'); await sleep(700)
  await s.evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => x.offsetParent !== null)
    const it = [...d.querySelectorAll('.efmt-item')].find(x => (x.textContent || '').includes('导出 Excel'))
    it?.click(); return 1
  })()`)
  await sleep(3500)
  const r3 = await s.evaluate(`({
    xhrs: window.__xhrs.filter(u => u.includes('/report/export')).slice(-2),
    urls: window.__urls.slice(-2),
    msgs: [...document.querySelectorAll('.el-message')].map(x => (x.textContent || '').trim()),
  })`)
  console.log('[③ 导出 Excel]', JSON.stringify(r3))

  // ④ 导出报表 → 打印预览(服务端 PDF,新窗口)
  await clickSide('导出报表'); await sleep(900)
  const rpt = await s.evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => x.offsetParent !== null)
    return d ? { title: (d.querySelector('.el-dialog__title') || {}).textContent, items: [...d.querySelectorAll('.efmt-name')].map(x => x.textContent.trim()) } : null
  })()`)
  console.log('[导出报表弹窗]', JSON.stringify(rpt))
  await s.evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => x.offsetParent !== null)
    const it = [...d.querySelectorAll('.efmt-item')].find(x => (x.textContent || '').includes('打印预览'))
    it?.click(); return 1
  })()`)
  await sleep(3500)
  const r4 = await s.evaluate(`({ opened: window.__opened, xhrs: window.__xhrs.filter(u => u.includes('/report/export')).slice(-2) })`)
  console.log('[④ 导出报表·打印预览]', JSON.stringify(r4))

  await s.close?.()
} finally { process.exit(0) }
