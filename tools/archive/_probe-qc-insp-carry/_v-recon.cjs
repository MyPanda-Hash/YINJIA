/* 一次性探针:来料检验要求(QC_INSP_REQ)与检验报告(QC_INSP_REC)当前实际渲染
   目的:确认面板表格是否真能渲染出行(接口 detail 键 = detail_key 而非 items 的疑点)
   用法:node tools/archive/_probe-qc-insp-carry/_v-recon.cjs(需 5173 + 8090 已起) */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9361
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-recon-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1500,1200',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1200); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')

    // ── A. 来料检验要求维护面板 ──
    await navigate('http://localhost:5173/#/panelx/list/QC_INSP_REQ')
    await sleep(4000)
    const A = await evaluate(`(() => {
      const sheet = document.querySelector('.qc-insp-sheet')
      const rows = [...document.querySelectorAll('.qc-insp-sheet .qc-paper tbody tr')]
      return JSON.stringify({
        hasSheet: !!sheet,
        tabs: [...document.querySelectorAll('.qc-insp-sheet .rsp-page-tab')].map(e => e.innerText.trim()),
        activeTab: document.querySelector('.qc-insp-sheet .rsp-page-tab.active')?.innerText.trim() || '',
        dataRows: rows.filter(r => !r.querySelector('.rs-empty') && !r.querySelector('.qc-title') && !r.classList.contains('rs-grp') && !r.classList.contains('rs-grp2')).length,
        firstRows: rows.slice(0, 4).map(r => r.innerText.replace(/\\s+/g, ' ').slice(0, 90)),
        empty: document.querySelector('.qc-insp-sheet .rs-empty')?.innerText.trim() || '',
      })
    })()`)
    console.log('【A 来料检验要求面板】', A)

    // ── B. 检验报告:点「检验要求」看弹窗 ──
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/panelx/list/QC_INSP_REC')
    await sleep(4000)
    await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
    await sleep(1200)
    const B0 = await evaluate(`(() => JSON.stringify({
      sheet: !!document.querySelector('.qc-rec-sheet'),
      head: [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].map(t => t.innerText.trim()),
      code: (() => { const th = [...document.querySelectorAll('.qc-rec-sheet .qr-head-table th')].find(t => t.innerText.trim() === '物料编码'); return th?.nextElementSibling?.querySelector('input')?.value ?? null })(),
      carryBtn: !!document.querySelector('.qr-carry-btn'),
      side: [...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g, '')),
    }))()`)
    console.log('【B0 报告页】', B0)
    const B1 = await evaluate(`(() => { const s = document.querySelector('.qr-lib-btn'); s?.click(); return s ? s.innerText : '' })()`)
    console.log('   点到的链接 =', JSON.stringify(B1))
    await sleep(2500)
    const B2 = await evaluate(`(() => JSON.stringify({
      dlg: !!document.querySelector('.el-dialog'),
      dlgText: (document.querySelector('.el-dialog')?.innerText || '').replace(/\\s+/g, ' ').slice(0, 220),
      reqRows: document.querySelectorAll('.el-dialog .qc-paper tbody tr').length,
    }))()`)
    console.log('【B2 检验要求弹窗】', B2)
  } finally {
    edge.kill()
  }
}
main().catch((e) => { console.error('探针异常:', e); process.exitCode = 1 })
