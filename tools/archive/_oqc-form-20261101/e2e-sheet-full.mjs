/**
 * e2e-sheet-full.mjs —— 出厂检验报告「纸张式面板」端到端(2026-11-01 第三轮)
 *  ① 销售出库单勾选 → 生成 → 跳转 → 面板是纸张式受控表单(不是数据表页)
 *  ② 纸上编辑 → 保存 → 刷新后仍在(落库)
 *  ③ 打印:body.approval-printing + CDP Page.printToPDF → PDF(浏览器打印同口径)
 *  ④ 导出报表 → 打印预览 → 服务端受控表单 PDF(blob)
 *
 * 前提:8090 已是含本轮前端+后端的 jar;测试账套有演示出库单 XSCK-2026-11-99001。
 * 用法: node e2e-sheet-full.mjs [base] [factory] [outNo]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const FACTORY = process.argv[3] || 'YJ_TEST'
const OUT_NO = process.argv[4] || 'XSCK-2026-11-99001'
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

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

const s = await launch({ port: 9475 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(1800)
  await s.evaluate(`(() => {
    localStorage.setItem('mes_token', ${JSON.stringify(token)})
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
    localStorage.setItem('mes_factory', JSON.stringify({ code: '${FACTORY}', name: 'YINJIA-MES·测试库' }))
    localStorage.setItem('mes_locale', 'zh-CN')
    return 'ok'
  })()`)

  // ---- ① 销售出库 → 生成 → 跳转 ----
  await s.evaluate(`(() => { location.href = ${JSON.stringify(BASE + '/#/panelx/list/SALE_OUT?docNo=' + OUT_NO)}; location.reload(); return 1 })()`)
  await sleep(9000)
  const clicked = await s.evaluate(`(() => {
    const el = [...document.querySelectorAll('.tb-group .tb-main')].find(x => (x.textContent || '').includes('生成出厂检验报告'))
    if (!el) return 'no-generate-btn:' + [...document.querySelectorAll('.tb-group .tb-main')].map(x => (x.textContent || '').trim()).join('/')
    el.click(); return 'clicked'
  })()`)
  console.log('[generate-click]', clicked)
  await sleep(3500)
  const confirmed = await s.evaluate(`(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => { const ov = d.closest('.el-overlay'); return ov ? getComputedStyle(ov).display !== 'none' : false }).pop()
    if (!dlg) return 'no-dialog'
    const btns = [...dlg.querySelectorAll('button')]
    const b = btns.find(x => (x.textContent || '').trim() === '生成出厂检验报告') || btns.find(x => (x.className || '').includes('el-button--primary'))
    if (!b) return 'no-confirm:' + btns.map(x => (x.textContent || '').trim()).join('/')
    b.click(); return 'confirmed'
  })()`)
  console.log('[confirm]', confirmed)
  await sleep(10000)

  const st1 = await s.evaluate(`(() => {
    const txt = (el) => (el?.textContent || '').trim()
    const paper = document.querySelector('.oqc-sheet')
    const rows = paper ? [...paper.querySelectorAll('.oqc-grid > tbody > tr')] : []
    const detailRows = rows.filter(tr => tr.querySelectorAll('td').length >= 7)
    const sideBtns = [...document.querySelectorAll('.as-side-btn')].map(txt)
    return {
      hash: location.hash,
      docChip: txt(document.querySelector('.doc-chip')),
      railActive: txt(document.querySelector('.doc-select-rail tr.active')),
      isApprovalLayout: !!document.querySelector('.approval-layout'),
      hasPaper: !!paper,
      paperRows: detailRows.length,
      hygieneRows: paper ? paper.querySelectorAll('.oqc-hygiene-table tbody tr').length : 0,
      sideBtns,
      printCount: sideBtns.filter(x => x === '打印').length,
      hasOldToolbar: !!document.querySelector('.tools .tb-group'),
      inputs: paper ? paper.querySelectorAll('input, textarea').length : 0,
      railRows: document.querySelectorAll('.doc-select-rail .rail-row, .doc-select-rail tbody tr').length,
    }
  })()`)
  console.log('[state1]', JSON.stringify(st1))
  await shot(s, 'e2e-sheet-1-paper.png')

  // ---- ② 纸上编辑 → 保存 → 刷新后仍在 ----
  const docNo = (/OQC-\d{4}-\d{2}-\d{4}/.exec(st1.railActive || '') || [])[0] || ''
  console.log('[oqcNo]', docNo)
  const editRes = await s.evaluate(`(() => {
    const paper = document.querySelector('.oqc-sheet')
    if (!paper) return 'no-paper'
    const tr = [...paper.querySelectorAll('.oqc-grid > tbody > tr')].find(x => x.querySelectorAll('td').length >= 7)
    if (!tr) return 'no-row'
    const td = tr.querySelectorAll('td')[3] // 抽样标准
    const inp = td.querySelector('input, textarea')
    if (!inp) return 'no-input'
    inp.focus()
    const setter = inp.tagName === 'TEXTAREA'
      ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(inp, 'E2E-抽样标准')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    inp.blur()
    return 'typed:' + inp.value
  })()`)
  console.log('[edit]', editRes)
  await sleep(800)
  const saved = await s.evaluate(`(() => {
    const btn = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '保存')
    if (!btn) return 'no-save-btn'
    btn.click(); return 'save-clicked'
  })()`)
  console.log('[save]', saved)
  await sleep(1200)
  const msgs1 = await s.evaluate(`[...document.querySelectorAll('.el-message')].map(x => (x.textContent || '').trim())`)
  await sleep(3000)
  const msgs2 = await s.evaluate(`[...document.querySelectorAll('.el-message')].map(x => (x.textContent || '').trim())`)
  console.log('[msg-after-save]', JSON.stringify(msgs1), '|', JSON.stringify(msgs2))
  // 刷新后读回
  const reloadUrl = JSON.stringify(BASE + '/#/panelx/list/QC_OQC_REPORT?docNo=' + encodeURIComponent(docNo))
  await s.evaluate(`(() => { location.href = ${reloadUrl}; location.reload(); return 1 })()`)
  await sleep(9000)
  const persisted = await s.evaluate(`(() => {
    const paper = document.querySelector('.oqc-sheet')
    if (!paper) return { ok: false }
    const tr = [...paper.querySelectorAll('.oqc-grid > tbody > tr')].find(x => x.querySelectorAll('td').length >= 7)
    const inp = tr ? tr.querySelectorAll('td')[3].querySelector('input, textarea') : null
    return { ok: true, value: inp ? inp.value : '(no input)', text: (paper.innerText || '').includes('E2E-抽样标准') }
  })()`)
  console.log('[persisted]', JSON.stringify(persisted))
  // 还原(把演示数据清干净)
  if (persisted.ok && persisted.text) {
    await s.evaluate(`(() => {
      const paper = document.querySelector('.oqc-sheet')
      const tr = [...paper.querySelectorAll('.oqc-grid > tbody > tr')].find(x => x.querySelectorAll('td').length >= 7)
      const inp = tr.querySelectorAll('td')[3].querySelector('input, textarea')
      const setter = inp.tagName === 'TEXTAREA'
        ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
        : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(inp, ''); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.blur(); return 1
    })()`)
    await sleep(600)
    await s.evaluate(`(() => { const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '保存'); if (b) b.click(); return 1 })()`)
    await sleep(3000)
    console.log('[restore] 已把 抽样标准 清回空并保存')
  }

  // ---- ③ 打印:approval-printing + printToPDF ----
  await s.evaluate(`(() => { document.body.classList.add('approval-printing'); return 1 })()`)
  await sleep(600)
  const pdf = await s.send('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true,
    paperWidth: 8.27, paperHeight: 11.69,
    marginTop: 0.31, marginBottom: 0.31, marginLeft: 0.31, marginRight: 0.31,
  })
  await s.evaluate(`(() => { document.body.classList.remove('approval-printing'); return 1 })()`)
  if (pdf?.result?.data) {
    await fs.writeFile(HERE + 'e2e-sheet-print.pdf', Buffer.from(pdf.result.data, 'base64'))
    console.log('[print-pdf] e2e-sheet-print.pdf')
  } else console.log('[print-pdf][FAIL]', JSON.stringify(pdf).slice(0, 200))

  // ---- ④ 导出报表 → 打印预览(服务端受控表单 PDF) ----
  await s.evaluate(`(() => {
    window.__oqcOpened = null
    window.open = (u) => {
      if (u) window.__oqcOpened = String(u)
      return { location: { get href() { return '' }, set href(v) { window.__oqcOpened = String(v) } }, focus() {}, close() {} }
    }
    return 'hooked'
  })()`)
  const rep = await s.evaluate(`(() => {
    const btn = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '导出报表')
    if (!btn) return 'no-report-btn'
    btn.click(); return 'clicked'
  })()`)
  console.log('[report-dialog]', rep)
  await sleep(1500)
  const prev = await s.evaluate(`(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => { const ov = d.closest('.el-overlay'); return ov ? getComputedStyle(ov).display !== 'none' : false }).pop()
    if (!dlg) return 'no-dialog'
    const item = [...dlg.querySelectorAll('.efmt-item')].find(x => (x.textContent || '').includes('打印预览'))
    if (!item) return 'no-preview-item:' + [...dlg.querySelectorAll('.efmt-name')].map(x => (x.textContent || '').trim()).join('/')
    item.click(); return 'preview-clicked'
  })()`)
  console.log('[report-preview]', prev)
  await sleep(4000)
  const opened = await s.evaluate(`String(window.__oqcOpened || '')`)
  const stillOpen = await s.evaluate(`!!document.querySelector('.el-dialog:not([style*="display: none"])')`)
  console.log('[opened]', opened.slice(0, 80), '| dialogStillOpen=' + stillOpen)
  await shot(s, 'e2e-sheet-2-after-preview.png')

  await s.close?.()
} finally { process.exit(0) }
