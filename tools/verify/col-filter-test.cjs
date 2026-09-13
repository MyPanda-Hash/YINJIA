/* 列头筛选 UI 验证:打开入库单,点击列头出现筛选输入,输入后行数据过滤 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const PORT = 9336
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cf-'))
  const edge = spawn(EDGE, ['--headless=new','--disable-gpu','--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i=0;i<40;i++) { await sleep(300); if (await evaluate('document.readyState')==='complete') { await sleep(800); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    // 打开客户档案(基础档案,明细行多,便于验证筛选)
    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/panelx/list/KHDA')
    await sleep(5000)

    // 1. 检查列头是否有筛选图标
    const filterIcons = await evaluate(`document.querySelectorAll('.col-hdr-ic').length`)
    console.log(`列头筛选图标: ${filterIcons} 个`)

    // 2. 点击第一个列头,检查筛选输入框出现
    await evaluate(`document.querySelector('.col-hdr')?.click(); 'ok'`)
    await sleep(500)
    const filterInput = await evaluate(`document.querySelector('.col-filter-inp input')?.placeholder || 'not found'`)
    console.log(`筛选输入框: ${filterInput}`)

    // 3. 输入筛选词并检查行数变化
    const rowCountBefore = await evaluate(`document.querySelectorAll('.el-table__row:not(.placeholder)').length`)
    await evaluate(`(() => {
      const inp = document.querySelector('.col-filter-inp input')
      if (!inp) return 'no input'
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(inp, '胜蓝')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      return 'typed'
    })()`)
    await sleep(1000)
    const rowCountAfter = await evaluate(`document.querySelectorAll('.el-table__row').length`)
    const visibleCells = await evaluate(`[...document.querySelectorAll('.el-table__row')].map(r => r.cells[0]?.textContent?.trim()).filter(Boolean).slice(0,5)`)
    console.log(`筛选前 ${rowCountBefore} 行 → 筛选"胜蓝"后 ${rowCountAfter} 行`)
    console.log(`首列内容: ${JSON.stringify(visibleCells)}`)

    // 4. 清除筛选
    await evaluate(`document.querySelector('.col-hdr-tag')?.click(); 'ok'`)
    await sleep(500)
    const rowCountCleared = await evaluate(`document.querySelectorAll('.el-table__row').length`)
    console.log(`清除筛选后 ${rowCountCleared} 行`)

    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
