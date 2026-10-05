/* 一次性排障:系列面板保存为什么没落库(打印提示语 + callButton 请求/响应)
   用法:node tools/archive/_probe-qc-insp-carry/_d-save-series.cjs */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9369
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
/** 用法:[前端地址] [面板码] [页签] —— 默认系列面板/阻垢系列;传 QC_INSP_REQ/折叠棉 可对照固定表面板 */
const PANEL = process.argv[3] || 'QC_INSP_REQ_SERIES'
const TAB_NAME = process.argv[4] || '阻垢系列'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dsave-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tabInfo = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const posts = []; const resps = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params?.exceptionDetails || {}
        console.log('[页面异常]', (d.exception?.description || d.text || '').split('\n').slice(0, 6).join(' | '))
      }
      if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'log'].includes(m.params?.type)) {
        console.log('[console.' + m.params.type + ']', (m.params.args || []).map((a) => String(a.value ?? a.description ?? '').slice(0, 220)).join(' '))
      }
      if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('/px/callButton')) {
        try { posts.push(JSON.parse(m.params.request.postData)) } catch { posts.push({ raw: String(m.params.request.postData).slice(0, 300) }) }
      }
      if (m.method === 'Network.responseReceived' && m.params.response.url.includes('/px/callButton')) resps.push(m.params.response.status)
    })
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const raw = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 50; i++) { await sleep(300); if (await raw('document.readyState') === 'complete') { await sleep(1200); return } } }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    await nav(`${APP}/#/login`)
    await raw(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
    await nav('about:blank')
    await nav(`${APP}/#/panelx/list/${PANEL}`)
    // 等纸张出来(vite dev 首访要现编模块,可能 >10s)
    for (let i = 0; i < 60; i++) {
      const r = await raw(`!!document.querySelector('.qc-insp-sheet .rsp-page-tab')`)
      if (r) break
      await sleep(1000)
    }
    await sleep(1500)
    await raw(`(() => { const t = [...document.querySelectorAll('.qc-insp-sheet .rsp-page-tab')].find(e => e.innerText.trim() === ${JSON.stringify(TAB_NAME)}); t?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!t })()`)
    await sleep(900)
    const side = await raw(`JSON.stringify({ side: [...document.querySelectorAll('.approval-side .as-side-btn')].map(e=>e.innerText.replace(/\\s/g,'')), addBar: !!document.querySelector('.qc-insp-sheet .rs-add'), barBtns: [...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].map(e=>e.innerText.trim()) })`)
    console.log('面板状态:', side)
    // 加一行 + 填值
    await raw(`(() => { const b = [...document.querySelectorAll('.qc-insp-sheet .rs-add')].find(e => e.innerText.includes('新增数据记录行')); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    await sleep(1200)
    const fill = await raw(`(() => {
      const tr = [...document.querySelectorAll('.qc-insp-sheet .qc-paper tbody tr')].find(t => t.getAttribute('data-edit') === '1')
      if (!tr) return 'NO-ROW'
      const setV = (el, v) => { if (!el) return 0; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return el.value }
      const ins = [...tr.querySelectorAll('input')]
      if (ins.length < 2) return 'ONLY-' + ins.length
      setV(ins[0], 'YJ-TEST-SERIES-DBG')
      setV(ins[1], '合格')
      const done = [...tr.querySelectorAll('.rs-op-btn')].find(e => e.innerText.includes('完成'))
      done?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return 'FILLED:' + ins.map(i => i.value).join('|')
    })()`)
    console.log('填行:', fill)
    await sleep(800)
    // ① 先确认点击事件能到按钮上(挂一个标记监听,再看 console)
    await raw(`(() => { const b = [...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].find(e => e.innerText.trim() === '保存'); if (!b) return 'NO-BTN'; b.addEventListener('click', () => console.log('MARKER-CLICK-OK'), { once: true }); return 'HOOKED' })()`)
    await raw(`(() => { document.querySelectorAll('.el-message').forEach(e => e.remove()); const b = [...document.querySelectorAll('.qc-insp-sheet .qc-bar-btn')].find(e => e.innerText.trim() === '保存'); b?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b })()`)
    await sleep(4000)
    // ② 直接问面板状态:侧栏按钮禁用态能反推 draftEditable/inlineSaving(见 buttonsFor:保存= !draftEditable || inlineSaving)
    console.log('侧栏按钮:', await raw(`JSON.stringify([...document.querySelectorAll('.approval-side .as-side-btn')].map(e=>[e.innerText.replace(/\\s/g,''), e.className.includes('disabled')]))`))
    console.log('提示语:', await raw(`JSON.stringify([...document.querySelectorAll('.el-message')].map(e=>e.innerText.replace(/\\s+/g,' ')))`))
    console.log('弹窗(确认框):', await raw(`JSON.stringify([...document.querySelectorAll('.el-message-box')].map(e=>e.innerText.replace(/\\s+/g,' ').slice(0,200)))`))
    console.log('callButton 请求体:', JSON.stringify(posts).slice(0, 900))
    console.log('callButton 响应码:', JSON.stringify(resps))
  } finally { edge.kill() }
}
main().catch((e) => { console.error('异常:', e); process.exitCode = 1 })
