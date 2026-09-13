/* 验证入库单仓库下拉框实际渲染的选项 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const PORT = 9335
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const loginRes = await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })
  const login = await loginRes.json()
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-opt-'))
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
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i=0;i<40;i++) { await sleep(300); if (await evaluate('document.readyState')==='complete') { await sleep(1000); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/panelx/list/RKD')
    await sleep(5000)

    // 找到仓库下拉框(el-select), 点击展开, 读取选项
    const selectInfo = await evaluate(`(() => {
      const selects = [...document.querySelectorAll('.query-ref-select .el-select')]
      if (!selects.length) return { found: false }
      // 找仓库那个(通过 label 或位置)
      const field = selects[0] // 第一个 ref-select 就是仓库(22行>20)
      const input = field.querySelector('input')
      return { found: true, placeholder: input?.placeholder || '', value: input?.value || '' }
    })()`)
    console.log('select:', JSON.stringify(selectInfo))

    // 点击下拉框展开选项
    await evaluate(`document.querySelector('.query-ref-select .el-select input')?.click(); 'ok'`)
    await sleep(1500)
    const options = await evaluate(`[...document.querySelectorAll('.el-select-dropdown__item')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 25)`)
    console.log('dropdown options:', JSON.stringify(options))
    const dropdownVisible = await evaluate(`document.querySelector('.el-select-dropdown')?.style?.display || 'not found'`)
    console.log('dropdown visible:', dropdownVisible)

    // 也检查 refSelectData 内部状态
    const selectData = await evaluate(`(() => {
      const selects = [...document.querySelectorAll('.query-ref-select .el-select')]
      if (!selects.length) return 'no select found'
      const opts = [...document.querySelectorAll('.el-select-dropdown__item')]
      return { selectCount: selects.length, optionCount: opts.length, firstOpt: opts[0]?.textContent?.trim() || '' }
    })()`)
    console.log('detail:', JSON.stringify(selectData))

    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile,{recursive:true,force:true}) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
