/* 一次性取证:①切页签后「⚙ 自定义字段」弹窗里显示的是不是本页签自己的自定义字段;
   ②「父字段」下拉在各页签能不能选(有没有候选项)。
   用法:node tools/archive/_probe-qc-insp-carry/_d-fielddlg.cjs [前端地址] */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9367
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dlg-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tabInfo = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })) })
    const raw = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 50; i++) { await sleep(300); if (await raw('document.readyState') === 'complete') { await sleep(1200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${APP}/#/login`)
    await raw(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
    await nav('about:blank')
    await nav(`${APP}/#/panelx/list/QC_INSP_REQ`)
    await sleep(3500)

    // 逐个页签:点开弹窗,读「字段列表」与「父字段候选」
    for (const tabName of ['折叠棉', '垫片', '无纺布', '自定义检验要求']) {
      await raw(`(() => { const t = [...document.querySelectorAll('.qc-insp-sheet .rsp-page-tab')].find(e => e.innerText.trim() === ${JSON.stringify(tabName)}); t?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!t })()`)
      await sleep(800)
      await raw(`(() => { const b = [...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].find(e => e.innerText.includes('自定义字段')); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
      await sleep(1600)
      const info = await raw(`(() => {
        const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('字段管理'))
        if (!d) return 'NO-DIALOG'
        const rows = [...d.querySelectorAll('.el-table__body tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim()).join('|'))
        const items = [...d.querySelectorAll('.el-form-item')]
        const byLabel = (t) => items.find(i => (i.querySelector('.el-form-item__label')?.innerText || '').trim().startsWith(t))
        const tabSel = byLabel('所属页签')?.querySelector('.el-select__selected-item, .el-select__placeholder')
        return JSON.stringify({
          摘要: (d.querySelector('.fm-summary')?.innerText || '').replace(/\\s+/g, ' ').trim(),
          字段列表: rows,
          所属页签已选: tabSel ? tabSel.innerText.trim() : '(无)',
          父字段表单项: !!byLabel('父字段'),
        })
      })()`)
      console.log(`【${tabName}】`, info)
      // 再看「父字段」下拉打开后有哪些候选
      const opts = await raw(`(async () => {
        const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('字段管理'))
        const items = [...(d?.querySelectorAll('.el-form-item') || [])]
        const byLabel = (t) => items.find(i => (i.querySelector('.el-form-item__label')?.innerText || '').trim().startsWith(t))
        const sel = byLabel('父字段')?.querySelector('.el-select__wrapper')
        if (!sel) return 'NO-PARENT-SELECT'
        sel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, 800))
        const list = [...document.querySelectorAll('.el-select-dropdown')].filter(p => p.offsetParent !== null)
        const items2 = list.length ? [...list[list.length - 1].querySelectorAll('.el-select-dropdown__item')].map(o => o.innerText.trim()) : []
         return JSON.stringify({ 候选: items2, 无数据提示: list.length ? list[list.length-1].innerText.includes('无数据') : null })
      })()`)
      console.log(`   父字段候选:`, opts)
      await raw(`(() => { const d = [...document.querySelectorAll('.el-dialog')].find(x => x.innerText.includes('字段管理')); d?.querySelector('.el-dialog__headerbtn')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 1 })()`)
      await sleep(900)
    }
  } finally { edge.kill() }
}
main().catch((e) => { console.error('异常:', e); process.exitCode = 1 })
