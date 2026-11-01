/**
 * e2e-ui.mjs —— 出厂检验报告「销售出库勾选 → 生成 → 跳转 → 导出」UI 端到端(2026-11-01)
 *
 * 前提:后端已重启到含新代码的 jar;测试账套 HSDZ_MES_TEST 里有演示出库单 XSCK-2026-11-99001
 *       (含 B-92-25 / C-23-11 两行,标准行数 15/10)。
 *
 * 用法: node e2e-ui.mjs [base] [factory] [outNo] [mode]
 *   mode = open | full (默认 full:open → 点按钮 → 弹窗 → 确认 → 跳转 → 截图)
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const FACTORY = process.argv[3] || 'YJ_TEST'
const OUT_NO = process.argv[4] || 'XSCK-2026-11-99001'
const MODE = process.argv[5] || 'full'
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const shot = async (s, name) => {
  const r = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const b64 = r?.result?.data
  if (!b64) { console.log('[shot][FAIL]', name, JSON.stringify(r).slice(0, 200)); return }
  await fs.writeFile(HERE + name, Buffer.from(b64, 'base64'))
  console.log('[shot]', name)
}

// ---- ① API 登录(测试账套),拿 token/user ----
const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json()
const token = login?.data?.token
const user = login?.data?.user
if (!token) { console.log('[login][FAIL]', JSON.stringify(login).slice(0, 300)); process.exit(1) }
console.log('[login]', FACTORY, user?.realName, 'factory=' + user?.factory)

const s = await launch({ port: 9463 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })
  await s.navigate(BASE + '/#/login'); await sleep(2500)
  // 注入登录态(等价于登录页登录:token/user/factory 三个 localStorage 键)
  const injected = await s.evaluate(`(() => {
    try {
      localStorage.setItem('mes_token', ${JSON.stringify(token)})
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))})
      localStorage.setItem('mes_factory', JSON.stringify({ code: '${FACTORY}', name: ${JSON.stringify(user?.factory === 'YJ_TEST' ? 'YINJIA-MES·测试库' : 'YINJIA-MES')} }))
      localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
      return 'ok'
    } catch (e) { return 'ERR ' + e.message }
  })()`)
  console.log('[inject]', injected)

  const docUrl = `${BASE}/#/panelx/list/SALE_OUT?docNo=${encodeURIComponent(OUT_NO)}`
  // ⚠ 注入 localStorage 后必须**整页重载**:user store 的 state 在启动时读 localStorage,
  //   只改 hash 不会重跑,路由守卫会把未登录状态重新踢回 /login(2026-11-01 实测)。
  await s.evaluate(`(() => { location.href = ${JSON.stringify(docUrl)}; location.reload(); return 'reloading' })()`)
  await sleep(9000)
  const state1 = await s.evaluate(`(() => {
    const txt = (el) => (el?.textContent || '').trim()
    return {
      url: location.hash,
      groups: [...document.querySelectorAll('.tb-group .tb-main')].map(txt),
      docChip: txt(document.querySelector('.doc-chip')),
      rows: document.querySelectorAll('.el-table__body tr').length,
      hasBtn: [...document.querySelectorAll('.tb-group .tb-main')].some(x => txt(x).includes('生成出厂检验报告')),
      dialogs: document.querySelectorAll('.el-dialog').length,
    }
  })()`)
  console.log('[state1]', JSON.stringify(state1))
  await shot(s, 'e2e-1-saleout.png')
  if (MODE === 'open') { console.log('[open] 只开页面,结束'); }
  else {
    // ---- ② 点「生成出厂检验报告」 ----
    const clicked = await s.evaluate(`(() => {
      const el = [...document.querySelectorAll('.tb-group .tb-main')].find(x => (x.textContent || '').includes('生成出厂检验报告'))
      if (!el) return 'no-button'
      el.click(); return 'clicked'
    })()`)
    console.log('[click]', clicked)
    await sleep(4000)
    const state2 = await s.evaluate(`(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.offsetParent !== null)
      if (!dlg) return { open: false, body: document.body.innerText.slice(0, 600) }
      const rows = [...dlg.querySelectorAll('.el-table__body tr')].map(tr => [...tr.querySelectorAll('td')].map(td => (td.textContent || '').trim()).join(' | '))
      const checks = [...dlg.querySelectorAll('.el-checkbox')].map(x => (x.className || '').includes('is-checked'))
      const btns = [...dlg.querySelectorAll('button')].map(b => (b.textContent || '').trim())
      return { open: true, title: (dlg.querySelector('.el-dialog__title')?.textContent || '').trim(), rows, checks, btns }
    })()`)
    console.log('[dialog]', JSON.stringify(state2).slice(0, 2500))
    await shot(s, 'e2e-2-dialog.png')

    // ---- ③ 确认生成(点弹窗底部主按钮) ----
    const confirmed = await s.evaluate(`(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find(d => d.offsetParent !== null)
      if (!dlg) return 'no-dialog'
      const btns = [...dlg.querySelectorAll('button')]
      const b = btns.find(x => (x.textContent || '').trim() === '生成' || (x.textContent || '').includes('生成出厂检验报告'))
        || btns.find(x => (x.className || '').includes('el-button--primary'))
      if (!b) return 'no-confirm-btn:' + btns.map(x => (x.textContent || '').trim()).join('/')
      b.click(); return 'clicked:' + (b.textContent || '').trim()
    })()`)
    console.log('[confirm]', confirmed)
    await sleep(9000)
    const state3 = await s.evaluate(`(() => {
      const txt = (el) => (el?.textContent || '').trim()
      return {
        url: location.hash,
        docChip: txt(document.querySelector('.doc-chip')),
        groups: [...document.querySelectorAll('.tb-group .tb-main')].map(txt),
        rows: document.querySelectorAll('.el-table__body tr').length,
        msg: [...document.querySelectorAll('.el-message')].map(txt),
        headText: (document.querySelector('.panelx-list')?.innerText || '').slice(0, 900),
      }
    })()`)
    console.log('[state3]', JSON.stringify(state3).slice(0, 2500))
    await shot(s, 'e2e-3-jumped.png')

    // ---- ④ 导出报告 PDF(服务端受控表单版式 qc_oqc) ----
    const mm = /OQC-[0-9A-Za-z-]+/.exec(state3.docChip || '')
    const oqcNo = mm ? mm[0] : ''
    console.log('[oqcNo]', oqcNo)
    if (oqcNo) {
      const r = await fetch(`${BASE}/api/report/export?code=qc_oqc&panelCode=QC_OQC_REPORT&docNo=${encodeURIComponent(oqcNo)}&format=pdf`, { headers: { Authorization: 'Bearer ' + token } })
      const ct = r.headers.get('content-type') || ''
      if (r.ok && !ct.includes('json')) {
        const buf = Buffer.from(await r.arrayBuffer())
        await fs.writeFile(HERE + 'e2e-4-report.pdf', buf)
        console.log('[export-pdf]', oqcNo, buf.length, 'bytes -> e2e-4-report.pdf')
      } else { console.log('[export-pdf][FAIL]', r.status, (await r.text()).slice(0, 300)) }
    }

    // ---- ⑤ 打印按钮:应打开服务端 PDF(拦 window.open 看是否拿到 blob:) ----
    await s.evaluate(`(() => { window.__oqcOpened = null; window.open = (u) => { window.__oqcOpened = String(u); return { focus() {}, close() {} } }; return 'hooked' })()`)
    const printClick = await s.evaluate(`(() => {
      const el = [...document.querySelectorAll('.tb-group .tb-main')].find(x => (x.textContent || '').trim() === '打印')
      if (!el) return 'no-print-btn'
      el.click(); return 'clicked'
    })()`)
    await sleep(4000)
    const opened = await s.evaluate(`String(window.__oqcOpened || '')`)
    const msgs = await s.evaluate(`[...document.querySelectorAll('.el-message')].map(x => (x.textContent||'').trim())`)
    console.log('[print]', printClick, '| opened=' + opened.slice(0, 70), '| msgs=' + JSON.stringify(msgs))
    await shot(s, 'e2e-5-print.png')
  }
  await s.close?.()
} finally { process.exit(0) }
